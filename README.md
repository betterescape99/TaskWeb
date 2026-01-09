# TaskWeb (Next.js + NextAuth + Prisma + MySQL)

一个多用户任务板 Web 应用：支持注册 / 登录、任务 CRUD、搜索筛选、完成状态管理。  

---

## 功能

- 注册 / 登录（NextAuth Credentials）
- 登录态 Session 保持
- 任务列表（All / Active / Done）
- 新增任务、完成 / 取消完成、删除任务
- 清空已完成（Clear done）
- 搜索（Search）
- 内联编辑（双击编辑，Ctrl + Enter 保存，Esc 取消）

---

## 技术栈

- Next.js（App Router）
- React + TypeScript
- NextAuth（Credentials Provider）
- Prisma ORM
- MySQL
- 部署：Vercel + 云 MySQL

---

## 项目结构（关键目录）

```text
app/
├─ api/
│  ├─ auth/[...nextauth]/route.ts
│  ├─ register/route.ts
│  ├─ tasks/route.ts
│  └─ tasks/[id]/route.ts
├─ login/
├─ register/
├─ page.tsx
├─ providers.tsx
lib/
├─ prisma.ts
zod/
├─ task.ts
validators/
├─ task.ts
prisma/
├─ schema.prisma
└─ migrations/
└─ migrations/                       # Prisma 迁移文件

---

## 环境变量

在本地创建 `.env` 文件：

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DBNAME"
NEXTAUTH_SECRET="replace-with-a-random-string"
NEXTAUTH_URL="http://localhost:3000"
```

## 本地运行
```
npm install
npx prisma generate
npm run dev
```
## 数据库迁移（本地）
```
npx prisma migrate dev
```
