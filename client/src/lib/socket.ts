import { io } from "socket.io-client";

const serverHost = process.env.VITE_SERVER_HOST ?? "localhost";
const serverPort = process.env.VITE_SERVER_PORT ?? "6666";

export const SOCKET_EVENTS = {
  connectionAck: "system:connection-ack",
  globalMessageSend: "global:message:send",
  globalMessageNew: "global:message:new",
  worldMessageSend: "world:message:send",
  worldMessageNew: "world:message:new",
  worldJoin: "world:join",
  worldLeave: "world:leave",
  worldMembersUpdate: "world:members:update",
  sceneSelect: "scene:select",
  sceneTokenMove: "scene:token:move",
  sceneTokenMoved: "scene:token:moved"
} as const;

export const socket = io(`http://${serverHost}:${serverPort}`, {
  autoConnect: false,
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3_000
});

export function connectSocket(token: string) {
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export function reconnectSocket() {
  if (!socket.connected) {
    socket.connect();
  }
}