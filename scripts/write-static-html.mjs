import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Marketing HTML is served from public/ on Vercel; keep a root copy in sync. */
export async function writeStaticHtml(relDir, html) {
  for (const base of [root, path.join(root, 'public')]) {
    const dir = path.join(base, relDir);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), html, 'utf8');
  }
}

export async function writeStaticFile(relFile, content) {
  for (const base of [root, path.join(root, 'public')]) {
    const dest = path.join(base, relFile);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, content, 'utf8');
  }
}
