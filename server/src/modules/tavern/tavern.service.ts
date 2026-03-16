import type { AssistantContextResult } from "../../services/assistant-context.service";

export function getTavernStatus() {
  return {
    enabled: false,
    mode: "standalone-module",
    message: "tavern module is isolated and can be replaced by external api"
  };
}

export type TavernAssistantDraft = {
  mode: "local-fallback";
  content: string;
  sourceCounts: {
    storyEventCards: number;
    recentMessages: number;
  };
};

export function generateTavernAssistantDraft(context: AssistantContextResult, instruction?: string): TavernAssistantDraft {
  const storyCardLines = context.storyEventCards.slice(0, 3).map((item, index) => {
    const parts = [
      `${index + 1}. ${item.title || "未命名事件"}`,
      item.summary ? `摘要：${item.summary}` : null,
      item.finalOutcome ? `后果：${item.finalOutcome}` : null
    ].filter(Boolean);
    return parts.join("；");
  });

  const messageLines = context.recentMessages.slice(0, 5).map((item, index) => {
    const author = item.fromUser.displayName || item.fromUser.username;
    return `${index + 1}. [${item.channelKey || "OOC"}] ${author}：${item.content}`;
  });

  const header = instruction?.trim() ? `【AI助手草案】${instruction.trim()}` : "【AI助手草案】当前场景剧情摘要";
  const blocks = [header];

  if (context.sceneId) {
    blocks.push(`场景：${context.sceneId}`);
  }

  if (storyCardLines.length > 0) {
    blocks.push("优先事件卡片：");
    blocks.push(...storyCardLines);
  } else {
    blocks.push("优先事件卡片：暂无，可退回最近聊天辅助判断。");
  }

  if (messageLines.length > 0) {
    blocks.push("最近聊天摘录：");
    blocks.push(...messageLines);
  }

  blocks.push("结论：以上内容为 AI 助手草案摘要，正式设定仍需 GM 审核确认。");

  return {
    mode: "local-fallback",
    content: blocks.join("\n"),
    sourceCounts: {
      storyEventCards: context.storyEventCards.length,
      recentMessages: context.recentMessages.length
    }
  };
}