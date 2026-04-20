# AAF Codex Navigation

This file is the low-token entry point for future work. Do not scan the whole repository by default.

## First Read

1. Read `docs/modules/README.md`.
2. Open only the module note matching the user's request.
3. Open `docs/世界模板实现蓝图.md` only when touching world UX, permissions, rules automation, resource editors, or crafting.

## Module Boundaries

- World shell and layout: `client/src/pages/world/WorldPage.tsx`, `client/src/world/components/*`, `client/src/styles/index.css`.
- Resource template library: `client/src/world/components/system/EntityManager.tsx`, `EntityVisualEditors.tsx`, `client/src/world/stores/worldEntityStore.ts`, `server/src/services/world-entity.service.ts`, `shared/types/world-entities.ts`.
- Rules and settlement: `shared/rules/*`, `server/src/services/ability-engine.service.ts`, `server/src/services/settlement.service.ts`.
- Scenes, combat, sockets: `server/src/services/scene.service.ts`, `server/src/routes/scene*.ts`, `server/src/socket/*`, `client/src/world/components/Scene*.tsx`, `BattleSequenceBar.tsx`.
- Characters and permissions: `server/src/services/character.service.ts`, `server/src/services/world.service.ts`, `shared/constants/roles.ts`, `shared/types/permissions.ts`.
- Life crafting: `shared/types/life-crafting.ts` and future module files; keep it decoupled from combat until rules are finalized.

## Editing Rules

- Update the relevant module note when changing a module boundary, responsibility, data contract, or UX rule.
- Update `docs/世界模板实现蓝图.md` for any world-template-facing change.
- Prefer localized verification: client UI changes run `npm run build -w client`; server/rule changes run `npm run build -w server` and related tests.
- Do not commit `规则书.txt`, temp screenshots, auth files, or generated test worlds.
