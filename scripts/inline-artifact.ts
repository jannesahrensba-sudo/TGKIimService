/**
 * Fasst den Artifact-Build (vite build --mode artifact) zu einer einzigen Datei zusammen:
 * dist-artifact/index.html mit eingebettetem JavaScript und CSS (lokal im Browser zu öffnen) und
 * dist-artifact/tg-ki-im-service.html ohne Dokumentgerüst – die Fassung zum Veröffentlichen als Claude-Artifact
 * (die Plattform ergänzt doctype, head und body selbst).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/node/model-store';

const dir = path.join(REPO_ROOT, 'dist-artifact');
const file = path.join(dir, 'index.html');
let html = await fs.readFile(file, 'utf8');
const inlined: string[] = [];

const read = async (ref: string) => {
  const abs = path.join(dir, ref.replace(/^\.?\//, ''));
  inlined.push(path.relative(dir, abs));
  return fs.readFile(abs, 'utf8');
};

for (const m of [...html.matchAll(/<link rel="stylesheet"[^>]*href="(\.?\/?assets\/[^"]+\.css)"[^>]*>/g)]) {
  const css = await read(m[1]);
  html = html.replace(m[0], () => `<style>\n${css}\n</style>`);
}
for (const m of [...html.matchAll(/<script type="module"[^>]*src="(\.?\/?assets\/[^"]+\.js)"[^>]*><\/script>/g)]) {
  // `</script` im Code würde das Tag vorzeitig schließen
  const js = (await read(m[1])).replace(/<\/script/gi, '<\\/script');
  html = html.replace(m[0], () => `<script type="module">\n${js}\n</script>`);
}
html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

const rest = (await fs.readdir(path.join(dir, 'assets'))).filter((f) => !inlined.includes(path.join('assets', f)));
if (rest.length) throw new Error(`Nicht eingebettete Dateien: ${rest.join(', ')}`);
if (/src="\.?\/?assets\//.test(html) || /href="\.?\/?assets\//.test(html)) throw new Error('Verweis auf assets/ übrig');

await fs.writeFile(file, html, 'utf8');
await fs.rm(path.join(dir, 'assets'), { recursive: true });

const pick = (re: RegExp, what: string) => html.match(re)?.[1] ?? (() => { throw new Error(`${what} fehlt`); })();
const head = pick(/<head>([\s\S]*?)<\/head>/, 'head')
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');
const fragment = `${head.trim()}\n${pick(/<body>([\s\S]*?)<\/body>/, 'body').trim()}\n`;
if (!fragment.startsWith('<title>')) throw new Error('<title> muss am Anfang stehen');
await fs.writeFile(path.join(dir, 'tg-ki-im-service.html'), fragment, 'utf8');
console.log(`dist-artifact/index.html – ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, eingebettet: ${inlined.join(', ')}`);
console.log('dist-artifact/tg-ki-im-service.html – Fassung für das Artifact');
