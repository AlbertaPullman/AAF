# AAF Monorepo

本仓库当前处于阶段 8 迭代中，已具备多人 TRPG 最小链路与世界内核心能力，并持续推进天赋树、规则书与 AI 辅助能力。

## 目录结构

- `client`: React 前端
- `server`: Express + Socket.IO 后端
- `data`: 数据目录（数据库、备份、上传）
- `shared`: 前后端共享常量
- `docs`: 协议和变更文档

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 初始化数据库

```bash
npm run db:generate
npm run db:migrate:init
npm run db:seed
```

后续新增迁移时使用：

```bash
npm run prisma:migrate -w server -- --name <migration-name>
```

3. 启动前后端

```bash
npm run dev
```

4. 单独启动

```bash
npm run dev -w server
npm run dev -w client
```

## 环境变量

复制 `.env.example` 到 `.env`，按需修改。数据库默认落在 `data/sqlite/aaf.db`。

## 阶段说明

当前是阶段 8：在阶段 7 核心链路完成基础上，继续推进世界内扩展能力（天赋树、规则书、剧情事件与 AI 辅助）。

当前已具备：登录鉴权、世界创建与加入、全局聊天、世界内聊天、多频道、最小 Token 同步、角色卡基础读写、多 Scene 切换与隔离、关键单元/HTTP/Socket 测试。

阶段 8 已开始并持续迭代中；酒馆与 AI 助手能力按已确认边界分步接入。

酒馆模块已独立目录占位，可在后续阶段直接替换为外部 API 方案或禁用。