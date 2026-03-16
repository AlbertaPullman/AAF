export type WorldRuntimeStatus = "loading" | "active" | "sleeping" | "error";

export type WorldRuntimeState = {
  worldId: string;
  status: WorldRuntimeStatus;
  message: string | null;
  updatedAt: string;
};
