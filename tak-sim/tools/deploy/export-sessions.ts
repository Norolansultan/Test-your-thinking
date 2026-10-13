/**
 * `npm run sessions:export -- --out <dir>` — on the machine that hosts the study, copies every
 * session file (finished uploads, checkpoints and their manifests) and the matching Thinker logs into
 * `<dir>/sessions/` and `<dir>/thinker/`, with `<dir>/index.json` (the same listing as /admin).
 * `--tar <file>` writes the same as one archive instead (the /api/admin/export.tar format).
 *
 * Reads SESSION_LOG_DIR (default logs/sessions) and logs/thinker; needs no server and no token
 * (whoever can run this can read the directories anyway). Existing files in `<dir>` are overwritten
 * with the current copies; nothing is ever deleted from the log directories.
 */

import { createWriteStream } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { exportEntries, listSessions, sessionFiles, tarStream, THINKER_LOG_DIR, type AdminDirs } from "../../server/production/admin-data.js";
import { repoPath } from "../../server/thinker/config.js";

export function exportDirs(env: Readonly<Record<string, string | undefined>>): AdminDirs {
  const sessions = env.SESSION_LOG_DIR;
  return {
    sessionLogDir: sessions ? (isAbsolute(sessions) ? sessions : repoPath(sessions)) : repoPath("logs/sessions"),
    thinkerLogDir: repoPath(THINKER_LOG_DIR),
  };
}

/** Copies everything into `out`; returns the number of files copied (index.json included). */
export async function exportToDirectory(dirs: AdminDirs, out: string): Promise<number> {
  const rows = await listSessions(dirs);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "index.json"), `${JSON.stringify(rows, null, 2)}\n`);
  let copied = 1;
  for (const row of rows) {
    for (const file of (await sessionFiles(dirs, row.sessionId)) ?? []) {
      const target = join(out, ...file.archivePath.split("/"));
      await mkdir(dirname(target), { recursive: true });
      try { await copyFile(file.path, target); copied++; } catch { /* removed meanwhile (a completion superseding a checkpoint) */ }
    }
  }
  return copied;
}

export async function exportToTar(dirs: AdminDirs, file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await pipeline(Readable.from(tarStream(exportEntries(dirs))), createWriteStream(file));
}

async function main(argv: readonly string[]): Promise<void> {
  const arg = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const out = arg("--out");
  const tar = arg("--tar");
  if ((out === undefined) === (tar === undefined)) {
    console.error("usage: npm run sessions:export -- --out <dir>   |   npm run sessions:export -- --tar <file.tar>");
    process.exitCode = 2;
    return;
  }
  const dirs = exportDirs(process.env);
  const rows = await listSessions(dirs);
  const complete = rows.filter((r) => r.status === "complete").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  if (out !== undefined) {
    const n = await exportToDirectory(dirs, resolve(out));
    console.log(`sessions:export: ${n} files -> ${resolve(out)}`);
  } else {
    await exportToTar(dirs, resolve(tar!));
    console.log(`sessions:export: archive -> ${resolve(tar!)}`);
  }
  console.log(`sessions:export: ${rows.length} sessions (${complete} complete, ${partial} partial only) from ${dirs.sessionLogDir} and ${dirs.thinkerLogDir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main(process.argv.slice(2));
