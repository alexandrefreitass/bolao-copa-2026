import { execFileSync } from 'node:child_process';
import process from 'node:process';

const ports = [3000, 3001, 3002];

if (process.platform === 'win32') {
  for (const port of ports) {
    let output = '';

    try {
      output = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess`],
        { encoding: 'utf8' },
      );
    } catch {
      continue;
    }

    const processIds = [...new Set(output.split(/\s+/).filter(Boolean))];
    for (const processId of processIds) {
      try {
        execFileSync('taskkill.exe', ['/PID', processId, '/T', '/F'], { stdio: 'ignore' });
        console.log(`Processo da porta ${port} encerrado.`);
      } catch {
        // The process may already have been stopped by a parent taskkill.
      }
    }
  }
} else {
  for (const port of ports) {
    try {
      execFileSync('sh', ['-c', `lsof -ti tcp:${port} | xargs -r kill`], { stdio: 'ignore' });
      console.log(`Processo da porta ${port} encerrado.`);
    } catch {
      // No process was listening on the port.
    }
  }
}
