import {
  PrismaClient,
  PlatformRole,
  WorldMemberStatus,
  WorldRole,
  WorldVisibility
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const masterPasswordHash = await bcrypt.hash("666999", 10);

  await prisma.user.upsert({
    where: { username: "nubes" },
    update: {
      displayName: "Nubes",
      passwordHash: masterPasswordHash,
      platformRole: PlatformRole.MASTER
    },
    create: {
      username: "nubes",
      passwordHash: masterPasswordHash,
      displayName: "Nubes",
      platformRole: PlatformRole.MASTER
    }
  });

  const owner = await prisma.user.upsert({
    where: { username: "seed-master" },
    update: {
      displayName: "Seed Master",
      platformRole: PlatformRole.MASTER
    },
    create: {
      username: "seed-master",
      passwordHash: "seed-password-hash",
      displayName: "Seed Master",
      platformRole: PlatformRole.MASTER
    }
  });

  const world = await prisma.world.upsert({
    where: { inviteCode: "seed-public-world" },
    update: {
      name: "Seed Public World",
      description: "用于阶段 2 验证数据库连通性的种子世界。",
      visibility: WorldVisibility.PUBLIC
    },
    create: {
      name: "Seed Public World",
      description: "用于阶段 2 验证数据库连通性的种子世界。",
      visibility: WorldVisibility.PUBLIC,
      inviteCode: "seed-public-world",
      ownerId: owner.id
    }
  });

  await prisma.worldMember.upsert({
    where: {
      worldId_userId: {
        worldId: world.id,
        userId: owner.id
      }
    },
    update: {
      role: WorldRole.GM,
      status: WorldMemberStatus.ACTIVE
    },
    create: {
      worldId: world.id,
      userId: owner.id,
      role: WorldRole.GM,
      status: WorldMemberStatus.ACTIVE
    }
  });

  await prisma.scene.upsert({
    where: {
      worldId_sortOrder: {
        worldId: world.id,
        sortOrder: 0
      }
    },
    update: {
      name: "Seed Default Scene"
    },
    create: {
      worldId: world.id,
      name: "Seed Default Scene",
      sortOrder: 0,
      canvasState: {
        version: 1,
        objects: []
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });