// Syntax checks use the same Node runtime as the application, without packages.
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['server.mjs'];
for (const directory of ['src', 'server', 'scripts', 'tests']) {
  for (const entry of await readdir(new URL(`../${directory}/`, import.meta.url))) {
    if (/\.m?js$/.test(entry)) files.push(`${directory}/${entry}`);
  }
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntaxe vérifiée : ${files.length} fichiers JavaScript.`);
