import { http } from "./http";

const apiBase = String(http.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

export function resolvePublicAssetUrl(value: unknown): string | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/uploads/")) return `${apiBase}${raw}`;
  return raw;
}