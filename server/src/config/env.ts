import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envCandidates = [...new Set([
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), ".env")
])];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function normalizeDatabaseUrl(databaseUrlRaw: string): string {
  if (!databaseUrlRaw.startsWith("file:")) {
    return databaseUrlRaw;
  }

  const filePathRaw = databaseUrlRaw.slice("file:".length);
  if (!filePathRaw) {
    return databaseUrlRaw;
  }

  if (filePathRaw.startsWith("//")) {
    return databaseUrlRaw;
  }

  const schemaDir = path.resolve(__dirname, "../../prisma");
  const resolvedPath = path.isAbsolute(filePathRaw)
    ? filePathRaw
    : path.resolve(schemaDir, filePathRaw);

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  return `file:${resolvedPath.replace(/\\/g, "/")}`;
}

const rawDatabaseUrl = process.env.DATABASE_URL ?? "file:../../data/sqlite/aaf.db";
const databaseUrl = normalizeDatabaseUrl(rawDatabaseUrl);
process.env.DATABASE_URL = databaseUrl;

const workspaceRoot = path.basename(process.cwd()) === "server" ? path.resolve(process.cwd(), "..") : process.cwd();
const uploadsDir = path.resolve(workspaceRoot, "data/uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  serverPort: Number(process.env.SERVER_PORT ?? 7001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5174",
  jwtSecret: process.env.JWT_SECRET ?? "replace-with-a-secure-secret",
  jwtExpiresDays: Number(process.env.JWT_EXPIRES_DAYS ?? 365),
  databaseUrl,
  uploadsDir,
  chatRateLimitWindowMs: Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS ?? 10_000),
  chatRateLimitMaxMessages: Number(process.env.CHAT_RATE_LIMIT_MAX_MESSAGES ?? 5),
  chatBlockedWords: (process.env.CHAT_BLOCKED_WORDS ?? "")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
};