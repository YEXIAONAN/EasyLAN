// Optional packaging helper: validate native modules and copy static assets.
// No bundler, transpiler, downloaded dependency, or browser runtime is needed.
import { cp, mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
for (const file of await readdir(new URL('js/', root))) {
  if (!file.endsWith('.js')) continue;
  const path = new URL(`js/${file}`, root);
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(path)], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Invalid JavaScript: ${file}`);
  const source = await readFile(path, 'utf8');
  for (const [, relative] of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) await readFile(new URL(relative, path));
}
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true }); await mkdir(dist);
for (const name of ['index.html', 'js', 'css']) await cp(new URL(name, root), new URL(name, dist), { recursive: true });
for (const name of await readdir(new URL('public/', root))) await cp(new URL(`public/${name}`, root), new URL(name, dist));
console.log('EasyLAN static assets validated and copied to web/dist. No dependencies.');
