import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  serverPort: Number(process.env.SERVER_PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "replace-with-a-secure-secret",
  jwtExpiresDays: Number(process.env.JWT_EXPIRES_DAYS ?? 365),
  databaseUrl: process.env.DATABASE_URL ?? "file:../data/sqlite/aaf.db"
};