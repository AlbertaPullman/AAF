# AAF

AAF 是一个面向中文 TRPG 团务的 Web 平台，采用前后端分离架构，核心能力覆盖账号体系、世界管理、场景与角色、世界内聊天、运行时模块，以及阶段 8 持续建设中的世界扩展能力。

## 当前状态

- 代码仓库：前后端可独立开发与构建。
- 服务端：`npm test -w server` 通过。
- 全量构建：`npm run build` 通过。
- 当前主线：世界内系统深化，包括战斗、结算、实体管理、天赋与规则相关能力。

## 目录结构

- `client`：React + TypeScript + Vite 前端
- `server`：Express + Socket.IO + Prisma 后端
- `shared`：前后端共享常量、规则和类型
- `data`：SQLite 数据与运行数据
- `docs`：协议、规范、总计划与专题文档

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

3. 启动开发环境

```bash
npm run dev
```

4. 单独启动前后端

```bash
npm run dev -w server
npm run dev -w client
```

5. 运行验证

```bash
npm test -w server
npm run build
```

## 环境变量

复制根目录 `.env.example` 为 `.env`，再按本地环境补充配置。SQLite 默认使用 `data/sqlite/aaf.db`。

## 文档入口

- 总计划：`docs/AAF总计划.md`
- 技术说明：`技术栈.md`
- AI 开发记忆：`AI上下文记忆文档.md`
- 世界需求源文档：`世界需求与填写清单.md`
- 规则规格：`docs/规则规格-战斗与造物系统-v1.md`

## 文档治理约定

- 计划、路线图、验收、优化池统一收敛到 `docs/AAF总计划.md`
- 需求文档保留“为什么做”
- 协议/规则文档保留“怎么做”
- AI 记忆文档只保留“下一次继续开发必须知道什么”
