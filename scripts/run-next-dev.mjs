/**
 * Start `next dev` with a valid Node `--localstorage-file` path.
 * Avoids: Warning: `--localstorage-file` was provided without a valid path
 * (Node 22+ Web Storage API + empty/malformed NODE_OPTIONS or execArgv).
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageFile = join(root, ".next", "node-localstorage.json");

mkdirSync(dirname(storageFile), { recursive: true });

// Workers inherit NODE_OPTIONS; strip broken flags and set a valid path for child processes.
const cleaned = (process.env.NODE_OPTIONS || "")
  .split(/\s+/)
  .filter((token) => token && !/^--localstorage-file(?:=.*)?$/.test(token))
  .join(" ")
  .trim();

process.env.NODE_OPTIONS = [`--localstorage-file=${storageFile}`, cleaned].filter(Boolean).join(" ");

const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
