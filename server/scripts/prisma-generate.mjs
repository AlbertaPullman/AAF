import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

function resolvePrismaCli() {
  const candidates = [
    path.resolve(process.cwd(), "node_modules", "prisma", "build", "index.js"),
    path.resolve(process.cwd(), "..", "node_modules", "prisma", "build", "index.js"),
  ];

  const cliPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!cliPath) {
    throw new Error("Could not find the local Prisma CLI entrypoint.");
  }

  return cliPath;
}

function hashFile(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function resolveEngineTarget() {
  const candidates = [
    path.resolve(process.cwd(), "node_modules", ".prisma", "client", "query_engine-windows.dll.node"),
    path.resolve(process.cwd(), "..", "node_modules", ".prisma", "client", "query_engine-windows.dll.node"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function cleanupMatchingTempEngines(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return;
  }

  const directory = path.dirname(targetPath);
  const targetHash = hashFile(targetPath);

  for (const entry of fs.readdirSync(directory)) {
    if (!/^query_engine-windows\.dll\.node\.tmp\d+$/i.test(entry)) {
      continue;
    }

    const tempPath = path.join(directory, entry);
    if (hashFile(tempPath) !== targetHash) {
      continue;
    }

    try {
      fs.unlinkSync(tempPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[AAF] Prisma engine temp file cleanup skipped: ${message}`);
    }
  }
}

const prismaCli = resolvePrismaCli();
const result = spawnSync(process.execPath, [prismaCli, "generate", "--schema", "prisma/schema.prisma"], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
});

if (result.error) {
  console.error(`[AAF] Failed to start Prisma CLI: ${result.error.message}`);
  process.exit(1);
}

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  cleanupMatchingTempEngines(resolveEngineTarget());
  process.exit(0);
}

const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const renameMatch = combinedOutput.match(
  /EPERM: operation not permitted, rename '([^']*query_engine-windows\.dll\.node\.tmp\d+)' -> '([^']*query_engine-windows\.dll\.node)'/i,
);

if (!renameMatch) {
  process.exit(result.status ?? 1);
}

const [, tempPath, targetPath] = renameMatch;

if (!fs.existsSync(tempPath) || !fs.existsSync(targetPath)) {
  console.error(
    "[AAF] Prisma client generation failed because the engine DLL is locked. Stop the server dev process and retry.",
  );
  process.exit(result.status ?? 1);
}

if (hashFile(tempPath) !== hashFile(targetPath)) {
  console.error(
    "[AAF] Prisma client generation needs to replace the engine DLL with a different binary. Stop the server dev process and retry.",
  );
  process.exit(result.status ?? 1);
}

cleanupMatchingTempEngines(targetPath);

console.warn(
  "[AAF] Prisma client JS and type output was generated. Windows blocked replacing the loaded engine DLL, but both engine binaries are identical, so generation is being treated as successful.",
);
process.exit(0);
