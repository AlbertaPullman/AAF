import { prisma } from "../lib/prisma";
import { env } from "../config/env";

type ServiceStatus = "ok" | "error";

export type HealthSnapshot = {
  status: "ok" | "degraded";
  timestamp: string;
  services: {
    api: "ok";
    database: ServiceStatus;
  };
  database: {
    provider: "sqlite";
    url: string;
  };
  details?: {
    database: string;
  };
};

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const baseSnapshot: HealthSnapshot = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      api: "ok",
      database: "ok"
    },
    database: {
      provider: "sqlite",
      url: env.databaseUrl
    }
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return baseSnapshot;
  } catch (error) {
    return {
      ...baseSnapshot,
      status: "degraded",
      services: {
        ...baseSnapshot.services,
        database: "error"
      },
      details: {
        database: error instanceof Error ? error.message : "database ping failed"
      }
    };
  }
}