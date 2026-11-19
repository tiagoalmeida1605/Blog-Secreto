import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const directories = ["api/devhub/v1", "lib/devhub"];
const files = [];

async function collectMjsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectMjsFiles(path);
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      files.push(path);
    }
  }
}

for (const directory of directories) {
  await collectMjsFiles(resolve(root, directory));
}

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`Syntax check failed: ${file}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax checked ${files.length} DevHub API module(s).`);
