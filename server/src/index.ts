import { createServer } from "http";
import { app } from "./app";
import { initSocketServer } from "./socket";
import { env } from "./config/env";
import { logger } from "./config/logger";

const server = createServer(app);
initSocketServer(server);

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`port ${env.serverPort} is already in use. Stop existing process or change SERVER_PORT.`);
    process.exit(1);
  }

  logger.error(`server failed to start: ${error.message}`);
  process.exit(1);
});

server.listen(env.serverPort, () => {
  logger.info(`server listening on http://localhost:${env.serverPort}`);
});