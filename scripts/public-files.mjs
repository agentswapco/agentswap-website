/* Copies approved public assets while rejecting hidden configuration and links.
 * Exports: copyPublic. Dependencies: Node.js standard filesystem and path APIs. */
import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import { dirname, extname, join, basename } from 'node:path';
const EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.json', '.txt', '.xml', '.sh']);
const NAMES = new Set(['_headers']);
const PRIVATE = /^(?:credentials|service-account|gcloud-service-account)\.json$|\.(?:key|pem|tfstate|map)$|(?:^|[-_])(?:secret|private[-_]?key|password)(?:[-_.]|$)/i;
/** @param {string} source @param {string} destination @returns {Promise<void>} */
export async function copyPublic(source, destination) {
  const name = basename(source);
  const stat = await lstat(source);
  if (stat.isSymbolicLink() || (name.startsWith('.') && name !== '.well-known') || PRIVATE.test(name)) {
    throw new Error(`Refusing non-public asset: ${name}`);
  }
  if (stat.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const child of await readdir(source)) await copyPublic(join(source, child), join(destination, child));
    return;
  }
  if (!stat.isFile() || (!NAMES.has(name) && !EXTENSIONS.has(extname(name)))) throw new Error(`Unapproved asset type: ${name}`);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
