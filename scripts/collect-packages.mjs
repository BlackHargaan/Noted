import { readdir, readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
const target = process.argv[2];
if (!target || !/^[a-z0-9_-]+$/.test(target)) throw new Error('Pass a Rust target triple.');
const root = join('src-tauri','target',target,'release','bundle');
const out = 'packages';
await mkdir(out,{recursive:true});
const checksums=[];
async function collect(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const path=join(dir,entry.name);
    if (entry.isDirectory()) { if (!entry.name.endsWith('.app')) await collect(path); }
    else if (/\.(exe|dmg|deb|AppImage|msi)$/.test(entry.name)) {
      await copyFile(path,join(out,basename(path)));
      checksums.push(createHash('sha256').update(await readFile(path)).digest('hex')+'  '+basename(path));
    }
  }
}
await collect(root);
if (!checksums.length) throw new Error('No installable packages were produced.');
await writeFile(join(out,'SHA256SUMS.txt'),checksums.sort().join('\n')+'\n');
