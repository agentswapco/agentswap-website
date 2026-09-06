/* Builds the public static site without publishing workspace or preview files.
 * Entry point: node scripts/build.mjs; output: dist/ for Cloudflare Pages.
 * Dependencies: Node.js standard library only. */
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = join(root, 'dist');
const publicFiles = [
  'index.html', 'favicon.svg', 'robots.txt', 'sitemap.xml',
  'brand', 'css', 'docs', 'js', '.well-known',
];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of publicFiles) {
  await cp(join(root, file), join(destination, file), { recursive: true });
}
console.log('Built public website in dist/');
