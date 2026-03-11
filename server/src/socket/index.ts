import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { SOCKET_EVENTS } from "./events";

export function initSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin
    }
  });

  io.on("connection", (socket) => {
    logger.info(`socket connected: ${socket.id}`);
    socket.emit(SOCKET_EVENTS.connectionAck, { ok: true, socketId: socket.id });

    socket.on("disconnect", () => {
      logger.info(`socket disconnected: ${socket.id}`);
    });
  });

  return io;
}