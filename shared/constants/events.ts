export const EVENTS = {
  globalMessageSend: "global:message:send",
  globalMessageNew: "global:message:new",
  worldMessageSend: "world:message:send",
  worldMessageNew: "world:message:new",
  worldJoin: "world:join",
  worldLeave: "world:leave",
  worldMembersUpdate: "world:members:update",
  worldLatencyProbe: "world:latency:probe",
  worldLatencyUpdate: "world:latency:update",
  sceneSelect: "scene:select",
  tokenMove: "scene:token:move",
  tokenMoved: "scene:token:moved"
} as const;