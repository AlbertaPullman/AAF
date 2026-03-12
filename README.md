# AAF Monorepo

本仓库是 AAF 项目的阶段 2 基础设施骨架。

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

当前是阶段 2：Prisma + SQLite 数据库建模与后端基础设施。

酒馆模块已独立目录占位，可在后续阶段直接替换为外部 API 方案或禁用。