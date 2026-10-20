import { pathToFileURL } from 'node:url';

/** true, wenn das Modul direkt gestartet wurde (npx tsx …/datei.ts) und nicht importiert. */
export function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && pathToFileURL(entry).href === moduleUrl;
}
