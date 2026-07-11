# CleanNotes 项目记忆

## 项目基本信息
- 技术栈：Vue 3 + TypeScript + Pinia + TailwindCSS v4 + Tiptap + Supabase
- 主项目路径：`D:\CleanNotepad\v1.3.0\`
- 部署：dist 挂 IIS（纯 Web），`npm run copy:prod` 同步到 prod 仓库（`D:\CleanNotepad-Prod\v1.3.0`）
- **⚠️ robocopy 不能用 /MIR**：prod 有独立 .git，必须 `robocopy dist prod /E /XD .git`
- 构建：`npx vite build`，`base: './'`（相对路径，支持 IIS 子目录）
- `vite.config.ts` 注入 `__APP_VERSION__` + `__BUILD_TIME__`，侧栏底部显示，点击打开测试报告
- Git remote：`https://github.com/shzalen/cleannotes.git`（prod 仓库 `cleannotes-prod`）

## 认证与存储架构
- **Supabase Auth 邮箱+密码**（JWT 自动管理），`supabaseClient.ts` 创建客户端 + JWT 缓存
- RLS 策略用 `auth.uid()::text`，`buildHeaders()` 用 JWT Bearer token
- **纯在线架构**：`getStorage()` → `supabaseAdapter`，废弃 localStorage 数据层
- growthStorage 特殊：内存缓存模式（cachedState 等），写入 2s 防抖上传，flag 仍用 localStorage
- App.vue 初始化：`Promise.all([6 个 store.load()])` 并行；各视图 fire-and-forget load()
- Tiptap 扩展用 `useMemoStore().memos` 同步读取（store 已在 App 初始化时加载）
- 时间戳统一 UTC ISO（带 Z），`normalizeTimestamp()` 防护旧格式
- 旧用户迁移：RPC `migrate_user_data(p_phone)` + `clearOldLocalStorage()`

## 暗黑模式
- CSS 变量体系：`:root` + `[data-theme="dark"]` + `[data-theme="zuru"]`
- 四模式：light/dark/auto/zuru（ZURU 品牌红 #E53935，浅色底）
- hex 不允许出现在 .vue style 中，用 CSS 变量；半透明用 `color-mix()`
- html2canvas-pro 无法解析 var()，导出时 onclone 预收集计算值内联

## 模块概要
- **任务**：`inProgressAt` 字段记录执行耗时；已完成→待办需确认；`formatDuration()` 格式化
- **养成（烛）**：火焰=等级/光晕=活力/蜡烛体=累计经验；三态活力/倦意/复苏；growthStorage 独立
- **待办**：TodoItem 模型，可转任务，`activeTodos` 过滤已转条目
- **备忘录**：左右分栏布局，800ms 防抖自动保存，content-aware PATCH（content 不变时跳过重传）+ retry queue
- **周报**：AI 总结两阶段（同步占位→异步更新），失败静默跳过
- **删除公约**：所有删除操作必须先弹 ConfirmDialog

## 富文本编辑器（RichTextEditor.vue）
- Tiptap + 自定义扩展（SlashCommand/Mermaid/Mindmap/DoubleBracketLinker/MemoMention）
- 无固定工具栏：浮动气泡菜单 + 斜杠命令面板 + + 快速插入
- **图片上传**：Canvas 压缩（1920px + JPEG 80%）→ Supabase Storage 上传 → 公开 URL 引用，失败回退 base64
- Mermaid/Mindmap 通过动态 import 代码分割，500ms 防抖
- `MemoEditModal.vue` 已删除（孤儿文件，曾导致 Tiptap 被拉入入口 chunk）

## 性能优化（2026-07-10）
- **P1.1 初始加载**：vendor-vue 分离 + AppSidebar/XpToast 异步化 + 移除 extensions 强制分块 → 登录页 ~140KB gzip
- **P1.2 Bundle 拆分**：DOMPurify 经 ConfirmDialog→App.vue 静态链入入口 chunk → 改动态 import，入口 chunk 343KB→318KB（gzip 90KB）
- **P2.1 增量同步**：`syncState.ts` 管理 lastSyncAt → 各 store `load(force)` 增量获取 + Map 合并；登出 `clearAllLastSyncAt()`
- **P2.4 图片迁移**：base64 → Supabase Storage + Canvas 压缩；RLS 迁移到 auth.uid()
- **P4.4 渐进式渲染**：IntersectionObserver + 哨兵 + 批量递增 50（TaskRightPanel 3 个 v-for + MemoView 列表）
- **P4.3 写入节流**：task.ts 300ms 防抖 + Map 队列合并 + visibilitychange/登出 flush
- **P4.2 跨标签页同步**：BroadcastChannel 广播 + 各 store `load(force)` 强制刷新
- **P1.4/P1.5**：Tiptap 扩展已随 RichTextEditor 懒加载；Mermaid/Mindmap 已有防抖，无需改

## Supabase Storage
- Bucket: `cleannote_attachments`（Public），路径 `memo/{userId}/{randomUUID}-{safeName}`
- RLS: 公开读取 + `auth.uid()` 隔离写入/删除
- 函数：`supabaseUploadAttachment` / `supabaseGetPublicUrl` / `supabaseDeleteAttachment` / `supabaseCreateSignedUrl`
- 迁移 SQL: `migration-attachments-rls-update.sql`（x-user-id → auth.uid()）
- 文件上传 MIME 白名单：19 种安全类型（pdf/docx/xlsx/pptx/txt/csv/md/json/xml/zip/rar/7z/mp3/mp4/wav/flac 等）
- 路径用 `crypto.randomUUID()` 增强熵值（122 bits），防止路径遍历猜测

## 安全优化（2026-07-10）
- **S3.3+S5.2 文件附件**：MIME 白名单校验 + Storage 上传替代 base64 内嵌，失败回退 base64
- **S2.3 Storage 安全**：UUID 路径 + signed URL 函数（为 private bucket 迁移准备）
- **S6.1 XP 服务端校验**：RPC `cleannote_calculate_xp` (SECURITY DEFINER + auth.uid())，客户端优先 RPC 失败回退本地计算
- **迁移 SQL**: `migration-xp-verification-rpc.sql`（只访问 cleannote_tasks/growth 表，不影响其他数据库）
