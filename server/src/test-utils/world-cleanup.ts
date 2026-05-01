import { prisma } from "../lib/prisma";

export async function cleanupWorldGraphByOwnerUsername(ownerUsername: string) {
  const worlds = await prisma.world.findMany({
    where: { owner: { username: ownerUsername } },
    select: { id: true }
  });

  const worldIds = worlds.map((item) => item.id);
  if (worldIds.length === 0) {
    return;
  }

  await prisma.characterTalentAllocation.deleteMany({
    where: {
      instance: {
        worldId: { in: worldIds }
      }
    }
  });
  await prisma.aiSession.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.storyEvent.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.message.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.fateClock.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.deckDefinition.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.randomTable.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.worldTalentTreeInstance.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.backgroundDefinition.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.professionDefinition.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.raceDefinition.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.itemDefinition.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.abilityDefinition.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.character.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.scene.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.folder.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.worldMember.deleteMany({ where: { worldId: { in: worldIds } } });
  await prisma.world.deleteMany({ where: { id: { in: worldIds } } });
}
