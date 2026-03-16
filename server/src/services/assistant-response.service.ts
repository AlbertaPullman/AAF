import { prisma } from "../lib/prisma";
import { generateTavernAssistantDraft } from "../modules/tavern/tavern.service";
import { createWorldMessage } from "./chat.service";
import { getWorldAssistantContext, type AssistantContextInput } from "./assistant-context.service";

export type AssistantRespondInput = AssistantContextInput & {
  instruction?: string;
};

export type AssistantRespondResult = {
  message: {
    id: string;
    worldId?: string;
    channelKey?: string;
    sceneId?: string;
    content: string;
    metadata?: unknown;
    createdAt: string;
    fromUser: {
      id: string;
      username: string;
      displayName: string | null;
    };
  };
  context: {
    sceneId?: string;
    storyEventCardCount: number;
    recentMessageCount: number;
  };
  generation: {
    mode: "local-fallback";
  };
};

async function assertAssistantPermission(worldId: string, userId: string) {
  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }
  if (membership.role !== "GM" && membership.role !== "ASSISTANT") {
    throw new Error("only gm or assistant can trigger ai assistant");
  }
}

export async function createWorldAssistantResponse(
  worldId: string,
  userId: string,
  input: AssistantRespondInput = {}
): Promise<AssistantRespondResult> {
  await assertAssistantPermission(worldId, userId);

  const context = await getWorldAssistantContext(worldId, userId, input);
  const draft = generateTavernAssistantDraft(context, input.instruction);
  const created = await createWorldMessage(userId, worldId, draft.content, "SYSTEM", context.sceneId);

  const metadata = {
    sceneId: context.sceneId,
    aiAssistantContextTag: {
      mode: draft.mode,
      instruction: input.instruction?.trim() || null,
      storyEventCardCount: draft.sourceCounts.storyEventCards,
      recentMessageCount: draft.sourceCounts.recentMessages,
      generatedAt: context.generatedAt
    }
  };

  await prisma.message.update({
    where: { id: created.id },
    data: {
      metadata
    }
  });

  return {
    message: {
      ...created,
      metadata
    },
    context: {
      sceneId: context.sceneId,
      storyEventCardCount: context.storyEventCards.length,
      recentMessageCount: context.recentMessages.length
    },
    generation: {
      mode: draft.mode
    }
  };
}
