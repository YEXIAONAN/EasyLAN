import './build.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const server = spawn('go', ['run', './cmd/localchat', '-no-open'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', code => { process.exitCode = code ?? 1; });
