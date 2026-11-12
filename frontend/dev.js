import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..', 'backend');

function findPython() {
  const candidates = [
    path.join(backendDir, '.venv', 'Scripts', 'python.exe'),
    path.join(backendDir, '.venv', 'bin', 'python'),
    path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe'),
    path.join(__dirname, '..', '.venv', 'bin', 'python'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

const pythonExe = findPython();
console.log(`\x1b[36m[dev]\x1b[0m Starting backend (FastAPI) and frontend (Vite)...`);

const backend = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--port', '8000', '--reload'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false,
});

backend.on('error', (err) => {
  console.error(`\x1b[31m[backend error]\x1b[0m Failed to start backend:`, err.message);
});

const viteBin = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
const frontend = spawn(process.execPath, [viteBin], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false,
});

frontend.on('error', (err) => {
  console.error(`\x1b[31m[frontend error]\x1b[0m Failed to start frontend:`, err.message);
});

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  console.log(`\n\x1b[36m[dev]\x1b[0m Shutting down backend and frontend...`);

  const killProc = (child) => {
    if (!child || child.killed || !child.pid) return;
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' });
      } catch {}
    } else {
      try {
        child.kill('SIGTERM');
      } catch {}
    }
  };

  killProc(backend);
  killProc(frontend);
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
frontend.on('exit', () => cleanup());
backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\x1b[31m[backend]\x1b[0m Exited with code ${code}`);
  }
});
