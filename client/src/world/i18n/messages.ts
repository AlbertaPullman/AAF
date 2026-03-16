import { worldRuntimeMessagesZh, worldSceneRuntimeMessagesZh } from "./zh-CN";

const errorMessageMap: Record<string, string> = {
  "world not found": "世界不存在",
  forbidden: "无权访问该世界",
  "permission denied": "权限不足",
  "module not found": "模块不存在",
  "module status must be enabled or disabled": "模块状态必须是 enabled 或 disabled",
  "missing or disabled dependencies": "模块依赖缺失或未启用",
  "invalid world runtime status": "运行时状态不合法",
  "module dependencies cannot include itself": "模块依赖不能包含自身",
  "only gm can manage scene battle state": "仅 GM 可管理场景视觉与战斗状态",
  "scene not found in world": "场景不存在或不属于当前世界",
  "scene not found for world": "当前世界没有可用场景",
  "invalid scene combat status": "战斗状态不合法",
  "combat participants must be array": "参战者列表格式不合法",
  "combat state has no participants": "没有可推进的参战者"
};

export function mapWorldRuntimeErrorMessage(rawMessage: string | null | undefined): string {
  const message = String(rawMessage ?? "").trim();
  if (!message) {
    return "发生未知错误";
  }

  for (const key of Object.keys(errorMessageMap)) {
    if (message.includes(key)) {
      return errorMessageMap[key];
    }
  }

  return message;
}

export { worldRuntimeMessagesZh };
export { worldSceneRuntimeMessagesZh };
