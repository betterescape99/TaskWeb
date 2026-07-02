# 数据库迁移指南：sqlpub MySQL → Turso (libSQL/SQLite)

## 背景

sqlpub 的免费 MySQL 实例已过期，项目已迁移到 Turso（基于 libSQL，兼容 SQLite）。
代码层面已全部改好，以下是你需要做的操作步骤。

---

## 第一步：注册 Turso 并创建数据库

1. 打开 https://turso.tech 注册账号（可用 GitHub 登录）
2. 安装 Turso CLI（可选，也可在网页操作）：
   ```bash
   # macOS/Linux
   curl -sSfL https://get.tur.so/install.sh | bash
   # Windows (PowerShell)
   irm https://get.tur.so/install.ps1 | iex
   ```
3. 登录并创建数据库：
   ```bash
   turso auth login
   turso db create task-web
   ```
4. 获取连接信息：
   ```bash
   # 获取数据库 URL
   turso db show task-web --url
   # 输出类似: libsql://task-web-your-org.turso.io

   # 获取 Auth Token
   turso db tokens create task-web
   # 输出一长串 token 字符串
   ```

如果你在网页操作：进入数据库详情页，点击 "Connect" 或 "Settings" 即可看到 URL 和 Token。

---

## 第二步：同步数据库表结构到 Turso

在项目根目录执行：

```bash
# 临时设置 Turso 连接信息（替换为你的实际值）
export DATABASE_URL="libsql://task-web-violetperpetual.aws-ap-northeast-1.turso.io"
export DATABASE_AUTH_TOKEN="你的token"
# eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODMwMTQ1NzYsImlkIjoiMDE5ZjIzZWYtZDYwMS03NjIwLTk3OTMtN2EyMTViNzNkOWYzIiwia2lkIjoiRmJMS2plT2x1WHpRWksza29OWVFPQjItbVIzeVd2enpJUjhmc25iZTB5RSIsInJpZCI6ImUyZjhkZTFjLTVjOGYtNGFhMS05NmUxLWZjZjkzNWUwZDNhOCJ9.FF6QWYpLfc3_AKzrkVth6XSz5szeKCFmdXzTftyVR16UOvTzeFZzMWx01VKuGks_V2why4OzPpX4Yvy5D1ZNAA
# 
# 推送表结构
npx prisma db push
```

这会在 Turso 上创建所有表（User, Task, Account, Session, VerificationToken）。

---

## 第三步：在 Vercel 中配置环境变量

1. 打开你的 Vercel 项目 → Settings → Environment Variables
2. 添加/修改以下变量：

| Name | Value | Environment |
|------|-------|-------------|
| `DATABASE_URL` | `libsql://task-web-your-org.turso.io` | Production, Preview |
| `DATABASE_AUTH_TOKEN` | 你的 Turso token | Production, Preview |
| `NEXTAUTH_SECRET` | 一个随机长字符串（可用 `openssl rand -base64 32` 生成） | Production, Preview |
| `NEXTAUTH_URL` | `https://你的域名.vercel.app` | Production |

3. 注意：**不要**在 Vercel 中设置本地开发的 `file:./dev.db`，生产环境必须用 Turso 的 `libsql://` 地址。

---

## 第四步：部署

```bash
git add -A
git commit -m "feat: migrate from MySQL to Turso (libSQL/SQLite)"
git push
```

Vercel 会自动检测到 push，重新构建并部署。

---

## 本地开发

本地开发不需要 Turso，直接用本地 SQLite 文件：

- `.env` 中保持 `DATABASE_URL="file:./dev.db"` 即可
- 首次运行前执行 `npx prisma db push` 创建本地数据库
- `dev.db` 已在 `.gitignore` 中，不会提交到 GitHub

常用命令：
```bash
npm run dev        # 启动开发服务器
npm run db:push    # 同步 schema 到数据库
npm run db:studio  # 打开 Prisma Studio 可视化查看数据
```

---

## 常见问题

### Q: Turso 免费 tier 限制？
- 500 个数据库
- 9GB 总存储
- 10 亿次读/月，2500 万次写/月
- 个人项目完全够用

### Q: 之前的用户数据怎么办？
sqlpub 的 MySQL 已无法连接，之前的数据无法迁移。新数据库是空的，需要重新注册账号。

### Q: Turso 也会过期吗？
Turso 的免费 tier 不会过期，只要你的账号活跃（30 天内有 API 调用），数据库就会保留。
