import process from 'node:process';

process.env.PORT ||= '3001';
process.env.USE_MEMORY_DB = 'true';
await import('./server.js');
