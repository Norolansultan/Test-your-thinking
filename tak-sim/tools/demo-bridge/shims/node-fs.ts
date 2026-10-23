/**
 * DEMONSTRATION ONLY: `node:fs` in the demo bridge's browser build (`build.ts` aliases it). The page has no file system, so
 * a read fails as a missing file does on the server — the bridge never ships the files the proxy reads from disk (the
 * premise-evidence table, the directive premises): it passes what it needs in its deps (`serve.ts`).
 */

export function readFileSync(path: unknown): never {
  throw new Error(`ENOENT: the demonstration bridge has no file system (${String(path)})`);
}

export const existsSync = (_path: unknown): boolean => false;
