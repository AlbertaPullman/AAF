import { FriendStatus, MessageType } from "@prisma/client";
import { prisma } from "../lib/prisma";

type PublicUser = {
  id: string;
  username: string;
  displayName: string | null;
};

function mapPublicUser(user: PublicUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName
  };
}

export async function listFriends(userId: string) {
  const rows = await prisma.friend.findMany({
    where: {
      status: FriendStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { addresseeId: userId }]
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true } },
      addressee: { select: { id: true, username: true, displayName: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return rows.map((row) => {
    const counterpart = row.requesterId === userId ? row.addressee : row.requester;
    return {
      id: row.id,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      user: mapPublicUser(counterpart)
    };
  });
}

export async function listIncomingFriendRequests(userId: string) {
  const rows = await prisma.friend.findMany({
    where: {
      addresseeId: userId,
      status: FriendStatus.PENDING
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    fromUser: mapPublicUser(row.requester)
  }));
}

export async function createFriendRequest(requesterId: string, query: string) {
  const normalized = typeof query === "string" ? query.trim() : "";
  if (!normalized) {
    throw new Error("friend query is required");
  }

  const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { id: true, username: true, displayName: true } });
  if (!requester) {
    throw new Error("requester not found");
  }

  const target = await prisma.user.findFirst({
    where: {
      id: { not: requesterId },
      OR: [{ username: { equals: normalized } }, { displayName: { equals: normalized } }]
    },
    select: { id: true, username: true, displayName: true }
  });

  if (!target) {
    throw new Error("target user not found");
  }

  const existing = await prisma.friend.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: requesterId }
      ]
    }
  });

  if (existing?.status === FriendStatus.ACCEPTED) {
    throw new Error("already friends");
  }

  if (existing?.status === FriendStatus.PENDING && existing.requesterId === requesterId) {
    throw new Error("friend request already sent");
  }

  if (existing?.status === FriendStatus.PENDING && existing.requesterId === target.id) {
    const updated = await prisma.friend.update({
      where: { id: existing.id },
      data: { status: FriendStatus.ACCEPTED },
      include: {
        requester: { select: { id: true, username: true, displayName: true } },
        addressee: { select: { id: true, username: true, displayName: true } }
      }
    });

    return {
      id: updated.id,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      requester: mapPublicUser(updated.requester),
      addressee: mapPublicUser(updated.addressee)
    };
  }

  if (existing) {
    const updated = await prisma.friend.update({
      where: { id: existing.id },
      data: {
        requesterId,
        addresseeId: target.id,
        status: FriendStatus.PENDING
      },
      include: {
        requester: { select: { id: true, username: true, displayName: true } },
        addressee: { select: { id: true, username: true, displayName: true } }
      }
    });

    return {
      id: updated.id,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      requester: mapPublicUser(updated.requester),
      addressee: mapPublicUser(updated.addressee)
    };
  }

  const created = await prisma.friend.create({
    data: {
      requesterId,
      addresseeId: target.id,
      status: FriendStatus.PENDING
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true } },
      addressee: { select: { id: true, username: true, displayName: true } }
    }
  });

  return {
    id: created.id,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
    requester: mapPublicUser(created.requester),
    addressee: mapPublicUser(created.addressee)
  };
}

export async function handleFriendRequest(userId: string, requestId: string, action: "accept" | "reject") {
  const existing = await prisma.friend.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { id: true, username: true, displayName: true } },
      addressee: { select: { id: true, username: true, displayName: true } }
    }
  });

  if (!existing) {
    throw new Error("friend request not found");
  }
  if (existing.addresseeId !== userId) {
    throw new Error("cannot handle this friend request");
  }
  if (existing.status !== FriendStatus.PENDING) {
    throw new Error("friend request is already handled");
  }

  const nextStatus = action === "accept" ? FriendStatus.ACCEPTED : FriendStatus.REJECTED;
  const updated = await prisma.friend.update({
    where: { id: requestId },
    data: { status: nextStatus },
    include: {
      requester: { select: { id: true, username: true, displayName: true } },
      addressee: { select: { id: true, username: true, displayName: true } }
    }
  });

  if (nextStatus === FriendStatus.REJECTED) {
    const actorName = updated.addressee.displayName || updated.addressee.username;
    await prisma.message.create({
      data: {
        type: MessageType.SYSTEM,
        channelKey: "SYSTEM",
        fromUserId: updated.addresseeId,
        toUserId: updated.requesterId,
        content: `你的好友申请被 ${actorName} 拒绝了。`,
        metadata: {
          systemType: "friend-request-rejected",
          requestId: updated.id
        }
      }
    });
  }

  return {
    id: updated.id,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    requester: mapPublicUser(updated.requester),
    addressee: mapPublicUser(updated.addressee)
  };
}