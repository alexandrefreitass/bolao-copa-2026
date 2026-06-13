import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const cwd = process.cwd();
const isLocalDevelopment = args.some((arg) => arg === '--dir=./pb_data_local');
const environment = {
  ...process.env,
  ...(isLocalDevelopment && {
    PB_SUPERUSER_EMAIL: process.env.PB_SUPERUSER_EMAIL || 'admin@bolao.local',
    PB_SUPERUSER_PASSWORD: process.env.PB_SUPERUSER_PASSWORD || 'bolao-local-2026',
    PB_LOCAL_ADMIN_EMAIL: process.env.PB_LOCAL_ADMIN_EMAIL || 'admin@bolao.local',
    PB_LOCAL_ADMIN_PASSWORD: process.env.PB_LOCAL_ADMIN_PASSWORD || 'bolao-local-2026',
  }),
};

if (process.platform === 'win32' && isLocalDevelopment) {
  const forwardedVariables = [
    'PB_SUPERUSER_EMAIL',
    'PB_SUPERUSER_PASSWORD',
    'PB_LOCAL_ADMIN_EMAIL',
    'PB_LOCAL_ADMIN_PASSWORD',
  ].join(':');

  environment.WSLENV = environment.WSLENV
    ? `${environment.WSLENV}:${forwardedVariables}`
    : forwardedVariables;
}

let command = './pocketbase';
let commandArgs = args;

if (process.platform === 'win32') {
  const parsed = path.win32.parse(cwd);
  const drive = parsed.root[0].toLowerCase();
  const linuxPath = `/mnt/${drive}/${cwd.slice(parsed.root.length).replaceAll('\\', '/')}`;

  command = 'wsl.exe';
  commandArgs = ['--cd', linuxPath, './pocketbase', ...args];
}

const child = spawn(command, commandArgs, {
  cwd,
  env: environment,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Não foi possível iniciar o PocketBase: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
