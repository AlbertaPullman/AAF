# AAF Monorepo

本仓库是 AAF 项目的阶段 1 工程骨架。

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

2. 启动前后端

```bash
npm run dev
```

3. 单独启动

```bash
npm run dev -w server
npm run dev -w client
```

## 环境变量

复制 `.env.example` 到 `.env`，按需修改。

## 阶段说明

当前是阶段 1：工程骨架与模块边界。

酒馆模块已独立目录占位，可在后续阶段直接替换为外部 API 方案或禁用。