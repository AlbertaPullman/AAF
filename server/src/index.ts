import { createServer } from "http";
import { app } from "./app";
import { initSocketServer } from "./socket";
import { env } from "./config/env";
import { logger } from "./config/logger";

const server = createServer(app);
initSocketServer(server);

server.listen(env.serverPort, () => {
  logger.info(`server listening on http://localhost:${env.serverPort}`);
});