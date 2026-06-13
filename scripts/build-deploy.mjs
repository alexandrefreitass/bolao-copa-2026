import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const frontendBuild = spawnSync('npm', ['run', 'build', '--prefix', 'apps/web'], {
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (frontendBuild.status !== 0) {
  process.exit(frontendBuild.status ?? 1);
}

rmSync('dist', { force: true, recursive: true });
mkdirSync('dist/public', { recursive: true });
cpSync('apps/web/dist', 'dist/public', { recursive: true });
cpSync('server.js', 'dist/server.js');

console.log('Pacote de implantação criado em dist/');
