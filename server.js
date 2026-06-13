import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

process.on('uncaughtException', (error) => console.error('Exceção não tratada:', error));
process.on('unhandledRejection', (error) => console.error('Rejeição não tratada:', error));

const port = Number(process.env.PORT) || 3000;
const appDirectory = dirname(fileURLToPath(import.meta.url));
const deployedFrontend = join(appDirectory, 'public');
const localFrontend = join(appDirectory, 'apps', 'web', 'dist');
const root = existsSync(deployedFrontend) ? deployedFrontend : localFrontend;
const sessionSecret = process.env.SESSION_SECRET || 'troque-esta-chave-em-producao';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@bolao.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'bolao-local-2026';
const useMemoryDatabase = process.env.USE_MEMORY_DB === 'true';
let databaseReady = useMemoryDatabase;
let databaseError = null;
const requiredDatabaseVariables = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingDatabaseVariables = useMemoryDatabase
  ? []
  : requiredDatabaseVariables.filter((variable) => !process.env[variable]);

const pool = useMemoryDatabase ? null : mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bolao',
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4',
});

const memoryDatabase = {
  apostas: [],
  logs: [],
  solicitacoes_exclusao: [],
  configuracao_bolao: [],
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const schemas = [
  `CREATE TABLE IF NOT EXISTS apostas (
    id VARCHAR(32) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(32) NOT NULL,
    placar VARCHAR(32) NOT NULL,
    status ENUM('pago', 'pendente') NOT NULL DEFAULT 'pendente',
    valor DECIMAL(10,2) NOT NULL DEFAULT 10,
    created DATETIME(3) NOT NULL,
    updated DATETIME(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS logs (
    id VARCHAR(32) PRIMARY KEY,
    acao VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    created DATETIME(3) NOT NULL,
    updated DATETIME(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS solicitacoes_exclusao (
    id VARCHAR(32) PRIMARY KEY,
    aposta_id VARCHAR(32) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    created DATETIME(3) NOT NULL,
    updated DATETIME(3) NOT NULL,
    INDEX idx_solicitacao_aposta (aposta_id)
  )`,
  `CREATE TABLE IF NOT EXISTS configuracao_bolao (
    id VARCHAR(32) PRIMARY KEY,
    placar_final VARCHAR(32) NULL,
    vencedores JSON NOT NULL,
    created DATETIME(3) NOT NULL,
    updated DATETIME(3) NOT NULL
  )`,
];

const id = () => randomBytes(12).toString('hex');
const now = () => new Date();

const serializeRecord = (record) => {
  if (!record) return record;
  const serialized = { ...record };
  for (const key of ['created', 'updated']) {
    if (serialized[key] instanceof Date) serialized[key] = serialized[key].toISOString();
  }
  if (typeof serialized.vencedores === 'string') {
    try {
      serialized.vencedores = JSON.parse(serialized.vencedores);
    } catch {
      serialized.vencedores = [];
    }
  }
  if (serialized.valor !== undefined) serialized.valor = Number(serialized.valor);
  return serialized;
};

const sendJson = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
};

const readJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const createToken = () => {
  const payload = Buffer.from(JSON.stringify({ email: adminEmail, exp: Date.now() + 1000 * 60 * 60 * 24 })).toString('base64url');
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const isAdmin = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = createHmac('sha256', sessionSecret).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp > Date.now();
  } catch {
    return false;
  }
};

const requireAdmin = (request, response) => {
  if (isAdmin(request)) return true;
  sendJson(response, 401, { message: 'Não autorizado' });
  return false;
};

const initializeDatabase = async () => {
  if (useMemoryDatabase) {
    databaseReady = true;
    return;
  }
  if (missingDatabaseVariables.length) {
    throw new Error(`Variáveis do banco ausentes: ${missingDatabaseVariables.join(', ')}`);
  }
  for (const schema of schemas) await pool.query(schema);
  databaseReady = true;
};

const listRecords = async (table, sort = 'created') => {
  const direction = sort.startsWith('-') ? 'DESC' : 'ASC';
  const field = sort.replace(/^-/, '') === 'created' ? 'created' : 'updated';
  if (useMemoryDatabase) {
    return [...memoryDatabase[table]]
      .sort((a, b) => direction === 'DESC' ? new Date(b[field]) - new Date(a[field]) : new Date(a[field]) - new Date(b[field]))
      .map(serializeRecord);
  }
  const [rows] = await pool.query(`SELECT * FROM \`${table}\` ORDER BY \`${field}\` ${direction}`);
  return rows.map(serializeRecord);
};

const createRecord = async (table, data) => {
  const allowedFields = {
    apostas: ['nome', 'telefone', 'placar', 'status', 'valor'],
    logs: ['acao', 'descricao'],
    solicitacoes_exclusao: ['aposta_id', 'nome'],
    configuracao_bolao: ['placar_final', 'vencedores'],
  };
  const safeData = Object.fromEntries(
    allowedFields[table].filter((field) => data[field] !== undefined).map((field) => [field, data[field]]),
  );
  const record = { id: id(), ...safeData, created: now(), updated: now() };
  if (table === 'configuracao_bolao') record.vencedores = JSON.stringify(record.vencedores || []);
  if (useMemoryDatabase) {
    memoryDatabase[table].push(record);
    return serializeRecord(record);
  }
  const columns = Object.keys(record);
  await pool.query(
    `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(record),
  );
  return serializeRecord(record);
};

const updateRecord = async (table, recordId, data) => {
  const allowedFields = {
    apostas: ['nome', 'telefone', 'placar', 'status', 'valor'],
    logs: ['acao', 'descricao'],
    solicitacoes_exclusao: ['aposta_id', 'nome'],
    configuracao_bolao: ['placar_final', 'vencedores'],
  };
  const changes = Object.fromEntries(
    allowedFields[table].filter((field) => data[field] !== undefined).map((field) => [field, data[field]]),
  );
  changes.updated = now();
  if (table === 'configuracao_bolao' && changes.vencedores) changes.vencedores = JSON.stringify(changes.vencedores);
  if (useMemoryDatabase) {
    const index = memoryDatabase[table].findIndex((record) => record.id === recordId);
    if (index === -1) throw new Error('Registro não encontrado');
    memoryDatabase[table][index] = { ...memoryDatabase[table][index], ...changes };
    return serializeRecord(memoryDatabase[table][index]);
  }
  const columns = Object.keys(changes);
  await pool.query(
    `UPDATE \`${table}\` SET ${columns.map((column) => `\`${column}\` = ?`).join(', ')} WHERE id = ?`,
    [...Object.values(changes), recordId],
  );
  const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [recordId]);
  return serializeRecord(rows[0]);
};

const apiHandler = async (request, response, url) => {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, databaseReady ? 200 : 503, {
      message: 'API disponível',
      database: databaseReady ? (useMemoryDatabase ? 'memory' : 'mysql') : 'indisponível',
      error: databaseError?.message,
    });
  }

  if (!databaseReady) return sendJson(response, 503, { message: 'Banco de dados temporariamente indisponível' });

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJson(request);
    const emailMatches = String(body.email || '').toLowerCase() === adminEmail.toLowerCase();
    const passwordMatches = String(body.password || '') === adminPassword;
    if (!emailMatches || !passwordMatches) return sendJson(response, 400, { message: 'Email ou senha incorretos' });
    return sendJson(response, 200, { token: createToken(), user: { email: adminEmail } });
  }

  const match = url.pathname.match(/^\/api\/(apostas|logs|solicitacoes-exclusao|configuracao-bolao)(?:\/([a-zA-Z0-9]+))?$/);
  if (!match) return false;

  const [, resource, recordId] = match;
  const table = resource.replaceAll('-', '_');
  const publicList = ['apostas', 'configuracao-bolao'].includes(resource);
  const publicCreate = ['apostas', 'solicitacoes-exclusao'].includes(resource);

  if (request.method === 'GET' && !recordId) {
    if (!publicList && !requireAdmin(request, response)) return true;
    const records = await listRecords(table, url.searchParams.get('sort') || 'created');
    const publicRecords = resource === 'apostas' && !isAdmin(request)
      ? records.map(({ telefone, ...record }) => record)
      : records;
    return sendJson(response, 200, publicRecords);
  }

  if (request.method === 'POST' && !recordId) {
    if (!publicCreate && !requireAdmin(request, response)) return true;
    return sendJson(response, 201, await createRecord(table, await readJson(request)));
  }

  if (request.method === 'PUT' && recordId) {
    if (!requireAdmin(request, response)) return true;
    return sendJson(response, 200, await updateRecord(table, recordId, await readJson(request)));
  }

  if (request.method === 'DELETE' && recordId) {
    if (!requireAdmin(request, response)) return true;
    if (useMemoryDatabase) {
      memoryDatabase[table] = memoryDatabase[table].filter((record) => record.id !== recordId);
    } else {
      await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [recordId]);
    }
    response.writeHead(204);
    response.end();
    return true;
  }

  return false;
};

const serveFrontend = (request, response, url) => {
  const requestedPath = normalize(join(root, decodeURIComponent(url.pathname)));
  const filePath = requestedPath.startsWith(root) && existsSync(requestedPath) && statSync(requestedPath).isFile()
    ? requestedPath
    : join(root, 'index.html');

  response.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  createReadStream(filePath).on('error', () => sendJson(response, 500, { message: 'Não foi possível carregar a aplicação' })).pipe(response);
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const handled = await apiHandler(request, response, url);
      if (!handled && !response.writableEnded) sendJson(response, 404, { message: 'Rota não encontrada' });
      return;
    }
    serveFrontend(request, response, url);
  } catch (error) {
    console.error(error);
    if (!response.writableEnded) sendJson(response, 500, { message: 'Erro interno do servidor' });
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Aplicação disponível na porta ${port}`);
  console.log(`Servindo frontend de ${root}`);

  initializeDatabase()
    .then(() => console.log(`Banco de dados ${useMemoryDatabase ? 'em memória' : 'MySQL'} inicializado`))
    .catch((error) => {
      databaseError = error;
      console.error('Falha ao inicializar o banco de dados:', error);
    });
});
