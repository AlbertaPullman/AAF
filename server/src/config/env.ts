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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  serverPort: Number(process.env.SERVER_PORT ?? 6666),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5174",
  jwtSecret: process.env.JWT_SECRET ?? "replace-with-a-secure-secret",
  jwtExpiresDays: Number(process.env.JWT_EXPIRES_DAYS ?? 365),
  databaseUrl: process.env.DATABASE_URL ?? "file:../../data/sqlite/aaf.db"
};