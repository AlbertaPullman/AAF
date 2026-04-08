# AI 上下文记忆文档（精简版）

本文档只保留“下一次开发直接会用到”的上下文，避免历史日志占用 token。

## 1. 当前项目快照

- 项目：AAF（TRPG Web 平台，前后端分离）。
- 前端：React + TypeScript + Vite。
- 后端：Node.js + Express + Socket.IO。
- 数据层：Prisma + SQLite。
- 当前阶段：阶段 8（迭代 B 持续中）。

## 2. 当前主线与边界

- 当前主线：阶段 8 的世界内能力深化与 AI 辅助链路完善。
- 已完成基础：登录鉴权、世界管理、世界聊天、多场景、角色卡基础、规则书、天赋树编辑与预览、角色天赋试用。
- 本阶段不做：无关主线的历史阶段返工。

## 3. 天赋系统（后续角色卡必须复用）

### 3.1 词缀统一结构

词缀只使用三元结构：

- `mastery: boolean`（通晓）
- `exclusive: boolean`（排他）
- `studyMax: number`（研习最大层级）

展示文本规则：

- `mastery=true` => `通晓`
- `studyMax>0` => `研习X`
- `exclusive=true` => `排他`
- 多词缀以中文逗号拼接。

### 3.2 节点解锁判定

统一公式：

- `masteryPass OR (requirementPass AND parentPass)`

其中：

- `requirementPass`：职业等级前置满足。
- `parentPass`：父节点学习状态满足。
- `masteryPass`：同名通晓替代解锁条件满足。

### 3.3 学习/回退约束

- 普通节点最大学习次数为 1。
- 研习节点最大学习次数为 `studyMax`。
- 排他节点互斥：同树已学习任一排他后，不能再学其他排他。
- 取消学习时，节点 rank 不能低于 `committedRanks`。

### 3.4 关键一致性规则（已修复）

- 当母节点被回退（叉掉）后，必须级联校验并回退所有失去前置条件的子孙节点。
- 级联回退过程需迭代直到状态收敛（无新增回退）。

### 3.5 角色卡接入契约

角色卡落地时必须复用同一套规则函数，不允许复制出第二套判定逻辑。

建议共用纯函数：

1. `parseAffixMeta(value, rawMeta)`
2. `canUnlockNode(node, ranks, professionLevels, allNodes)`
3. `canLearnNode(node, ranks, committedRanks, points, allNodes)`
4. `pruneInvalidLearnedNodes(ranks, committedRanks, professionLevels, allNodes)`
5. `getNodeLearningStatusText(node, unlocked, rank)`

## 4. 当前稳定页面

- 大厅天赋树预览：支持缩略图/详情图、节点连线、右侧详情。
- 角色天赋试用页：支持学习模式、保存/取消、重置、母子级联回退。
- 规则书：大厅只读预览 + 管理员编辑器。

## 5. 下一次开发建议顺序

1. 抽离天赋判定为共享纯函数模块（供试用页与角色卡共用）。
2. 落地角色卡天赋分配接口（读取、试算、提交、重置）。
3. 角色卡 UI 直接复用天赋树节点渲染与判定契约。
4. 补角色卡联调用例：
   - 母子级联回退
   - 排他冲突
   - 研习上限
   - 通晓同名不叠加

## 6. 文档维护规则

- 本文档只保留“未来会直接用到”的事实与规则。
- 历史流水日志不再堆积到本文件。
- 每次迭代只新增一段“当前主线变化 + 影响规则 + 下一步”。
