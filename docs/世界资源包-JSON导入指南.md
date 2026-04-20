# 世界资源包 JSON 导入指南（当前实现版）

本文档对应当前后端 `POST /api/worlds/{worldId}/collection-pack/import` 的真实实现字段，适用于把规则书内容快速转成可导入 JSON。

## 1. 先看结论

1. 导入接口目前只处理 5 类内容：`races`、`professions`、`backgrounds`、`abilities`、`items`。
2. 资源包根结构必须有 `contents`。
3. 你可以保留 `id/worldId/createdAt/updatedAt`，但推荐在导入文件里省略，交给系统生成。
4. 只有 GM 可导入。

## 2. 资源包根结构

```json
{
  "id": "pack-demo",
  "name": "示例合集包",
  "description": "勇者战魔王规则与素材",
  "version": "1.0.0",
  "author": "gm-001",
  "contents": {
    "races": [],
    "professions": [],
    "backgrounds": [],
    "abilities": [],
    "items": [],
    "fateClocks": [],
    "decks": [],
    "randomTables": [],
    "scenes": [],
    "talentTrees": []
  },
  "importPolicy": {
    "conflictResolution": "skip",
    "preserveCustom": true
  },
  "createdAt": "2026-04-18T00:00:00.000Z"
}
```

说明：
- 当前后端会读取 `contents`，并仅导入 `races/professions/backgrounds/abilities/items`。
- 其余内容可先保留在包内，后续版本扩展时可直接复用。

## 3. 各实体字段标准

### 3.1 种族 `contents.races[]`

```json
{
  "name": "高等精灵",
  "description": "擅长奥术与感知。",
  "loreText": "古老森林王廷血脉。",
  "iconUrl": "",
  "attrBonus": [{ "type": "fixed", "attribute": "dexterity", "amount": 2 }],
  "size": "medium",
  "speed": 30,
  "darkvision": 60,
  "creatureType": "humanoid",
  "languages": ["通用语", "精灵语"],
  "ageDesc": "成年约 100 岁。",
  "traits": [],
  "subtypes": []
}
```

### 3.2 职业 `contents.professions[]`

```json
{
  "name": "魔法师",
  "description": "以 MP、准备法术和法术强度 AP 施法的奥秘职业。",
  "loreText": "学院派施法者。",
  "iconUrl": "",
  "type": "combat",
  "hitDie": "1d6",
  "primaryAttribute": "intelligence",
  "saveProficiencies": ["intelligence", "wisdom"],
  "armorProficiencies": [],
  "weaponProficiencies": ["dagger", "staff"],
  "toolProficiencies": [],
  "skillChoices": { "count": 2, "options": ["arcana", "history", "investigation"] },
  "startingEquipment": ["法杖", "法术书"],
  "startingWealth": "4d4*10",
  "spellcastingAttr": "intelligence",
  "furyPerLevel": 0,
  "levelFeatures": [
    {
      "level": 1,
      "features": ["奥术恢复"],
      "linkedAbilityIds": ["ability_arcane_recovery"],
      "talentPointsClass": 0,
      "talentPointsGeneral": 0
    }
  ],
  "talentTreeIds": ["talent_tree_mage_core"]
}
```

### 3.3 背景 `contents.backgrounds[]`

```json
{
  "name": "学院学者",
  "description": "接受系统学术训练。",
  "loreText": "图书馆与导师体系中成长。",
  "iconUrl": "",
  "skillPoints": 2,
  "bonusLanguages": 1,
  "toolProficiencies": [],
  "startingEquipment": ["笔记本", "学者袍"],
  "features": [{ "name": "学术网络", "description": "可快速获取文献线索。" }]
}
```

### 3.4 能力 `contents.abilities[]`

```json
{
  "name": "火球术",
  "category": "spell",
  "source": "profession",
  "sourceName": "魔法师",
  "activation": "active",
  "actionType": "standard",
  "description": "投掷爆裂火球。",
  "rulesText": "20 尺半径范围造成 8d6 火焰伤害。",
  "iconUrl": "",
  "tags": ["fire", "aoe"],
  "levelReq": 5,
  "range": "150",
  "aoeShape": "sphere",
  "aoeSize": 20,
  "resourceCosts": [{ "type": "mp", "amount": 8, "label": "魔力值" }],
  "cooldown": null,
  "duration": "instantaneous",
  "durationValue": null,
  "concentration": false,
  "checkType": "savingThrow",
  "attackAttr": null,
  "saveDC": { "attribute": "intelligence", "base": 8 },
  "damageRolls": [{ "dice": "8d6", "damageType": "fire" }],
  "trigger": null,
  "effects": [],
  "reactionStrat": null,
  "spellLevel": 3,
  "spellSchool": "塑能",
  "spellComps": { "verbal": true, "somatic": true },
  "canUpcast": false,
  "upcastEffect": "",
  "sortOrder": 0
}
```

### 3.5 物品 `contents.items[]`

```json
{
  "name": "奥术法杖",
  "description": "提升施法稳定性的杖。",
  "category": "wand",
  "subcategory": "arcane",
  "rarity": "rare",
  "iconUrl": "",
  "weight": 2,
  "price": 1500,
  "stackable": false,
  "maxStack": null,
  "requiresIdent": false,
  "requiresAttune": true,
  "attuneReq": "spellcaster",
  "weaponProps": null,
  "armorProps": null,
  "enchantments": [{ "key": "spellAttack", "value": 1 }],
  "enhanceSlots": 0,
  "gemSlots": 1,
  "tags": ["magic", "focus"]
}
```

## 4. 导入 API

### 4.1 请求

```http
POST /api/worlds/{worldId}/collection-pack/import
Authorization: Bearer <token>
Content-Type: application/json
```

Body：完整资源包 JSON（见上）。

### 4.2 成功响应

```json
{
  "success": true,
  "data": {
    "races": 3,
    "professions": 2,
    "backgrounds": 4,
    "abilities": 42,
    "items": 18
  },
  "error": null
}
```

### 4.3 常见失败

- `403 permission denied`：当前账号不是 GM。
- `400 invalid pack: missing contents`：JSON 根对象缺少 `contents`。
- `400 xxx not found / invalid field`：单条数据字段类型不合法。

## 5. 口语规则转 JSON 的 AI 标准

把以下模板直接喂给 AI（替换其中规则文本）：

```text
你是 AAF 资源包转换器。请将我给出的规则文本转换成一个 JSON 对象，要求：
1) 输出必须是合法 JSON，不要 markdown。
2) 根结构必须包含：id,name,description,version,author,contents。
3) contents 至少包含 races/professions/backgrounds/abilities/items 五个数组。
4) 字段命名必须使用以下后端字段：
   - race: attrBonus, ageDesc, traits, subtypes
   - profession: saveProficiencies, spellcastingAttr, levelFeatures, talentTreeIds
   - ability: actionType, levelReq, attackAttr, spellComps, reactionStrat
   - item: requiresIdent, requiresAttune, attuneReq, weaponProps, armorProps
5) 不要输出 id/worldId/createdAt/updatedAt，除非我明确要求。
6) 若规则中未提及字段，用合理默认值填充，不要留 undefined。
```

## 6. 实战建议

1. 先小包验证：先只导入 1 个职业 + 3 个能力，确认字段正确，再批量导入。
2. 能力先行：先建 `abilities`，再在 `professions.levelFeatures.linkedAbilityIds` 里引用。
3. 天赋树分离：`talentTreeIds` 先占位，后续通过天赋树接口补全。
4. 版本留痕：每次导入前把 `version` 增量，方便回滚与审计。
