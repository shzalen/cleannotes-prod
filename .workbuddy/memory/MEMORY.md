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
- Tiptap + 自定义扩展（SlashCommand/Mermaid/Mindmap/DoubleBracketLinker）
- MemoMention 扩展已删除（@tiptap/extension-mention 崩溃问题，后续如需启用需重新实现）
- 无固定工具栏：浮动气泡菜单 + 斜杠命令面板 + + 快速插入
- **图片上传**：Canvas 压缩（1920px + JPEG 80%）→ Supabase Storage 上传 → 公开 URL 引用，失败回退 base64
- Mermaid/Mindmap 通过动态 import 代码分割，500ms 防抖
- `MemoEditModal.vue` 已删除（孤儿文件，曾导致 Tiptap 被拉入入口 chunk）

## 性能优化（2026-07-10）
- **P1.1 初始加载**：vendor-vue 分离 + AppSidebar/XpToast 异步化 + 移除 extensions 强制分块 → 登录页 ~140KB gzip
- **P1.2 Bundle 拆分**：DOMPurify 经 ConfirmDialog→App.vue 静态链入入口 chunk → 改动态 import，入口 chunk 343KB→318KB（gzip 90KB）
- **P2.1 增量同步（已废弃）**：纯在线架构无客户端缓存可合并，页面刷新后 Pinia 清空但 lastSyncAt 仍在 localStorage → 数据加载不出来。已移除增量同步，始终全量加载。syncState.ts 文件保留但不再读写。
- **P2.4 图片迁移**：base64 → Supabase Storage + Canvas 压缩；RLS 迁移到 auth.uid()
- **P4.4 渐进式渲染**：IntersectionObserver + 哨兵 + 批量递增 50（TaskRightPanel 3 个 v-for + MemoView 列表）
- **P4.3 写入节流**：task.ts 300ms 防抖 + Map 队列合并 + visibilitychange/登出 flush
- **P4.2 跨标签页同步**：BroadcastChannel 广播 + 各 store `load(force)` 强制刷新
- **P1.4/P1.5**：Tiptap 扩展已随 RichTextEditor 懒加载；Mermaid/Mindmap 已有防抖，无需改

## 第二轮安全与性能审计（2026-07-10/11）— 已全部修复
- **报告位置**：`public/test-reports/v1.3.0-security-perf-audit.html`
- **发现问题**：37 项（3 严重 / 8 高 / 15 中 / 11 低）+ 18 项已通过 → **全部修复完成**
- **P0 严重**：跨标签页广播缺失（todo/weeklyReport/growth）、memo DOMParser→正则、dragover 监听器泄漏
- **P1 安全**：CSP wasm-unsafe-eval、登出清 JWT、AI Key AES-GCM 加密、Supabase 密钥环境变量、Mermaid/setContent DOMPurify、DoubleBracketLinker textContent、跨标签登出同步
- **P2 中**：Link 协议白名单、DiagView 脱敏、PostgREST encodeURIComponent、错误消息脱敏、RPC 迁移锁、safeJsonParse、DELETE user_id、vite manualChunks（supabase/markdown/lunar）、写入重试队列、批量删除、loadPromise 防竞态、定时器清理、reload 防抖、StatsCards 单遍历
- **P3 低**：AiChat watch O(1)、AI 消息上限 200、syncState 死代码清理
- **新建文件**：`src/utils/crypto.ts`（AES-GCM）、`.env`/`.env.example`、`migration-rls-security-audit.sql`（需用户手动执行）
- **构建**：两次 vite build 通过，prod 仓库已 commit（d9adc21）

## 第三轮安全与性能审计复查（2026-07-11 PM）— 已全部修复
- **报告位置**：`public/test-reports/v1.3.0-security-perf-audit-r2.html` + `v1.3.0-security-perf-audit-r3.html`
- **结果**：0 严重 / 0 高 / 2 中 / 9 低 / 42 已通过 — 第一轮 37 项全部修复确认
- **新发现 11 项**（无 Critical/High），全部修复完成：
  - R2-S01(中) anon key 硬编码 fallback → 移除，构建时强制要求环境变量
  - R2-S02(中) AES-GCM APP_SECRET 客户端可见（架构限制，可接受）
  - R2-S03(低) 文件下载缺 rel=noopener → 已添加
  - R2-S04(低) hybrid.ts 注释过时 → 已更新
  - R2-S05(低) SlashCommand innerHTML → 改为 DOM API createElement + textContent
  - R2-S06(低) Storage API 错误未脱敏 → 添加 slice+replace 脱敏
  - R2-P01(低) window.__celebration → 限制 import.meta.env.DEV + onUnmounted 清理
  - R2-P02(低) BroadcastChannel 未关闭 → 添加 closeCrossTabSync()，登出时调用
  - R2-P03(低) memoStorage setInterval 未清理 → 添加 cleanupMemoStorage()，登出时调用
  - R2-P04(低) hybrid.ts 500 行死代码（未处理，保留备查）
  - R2-P05(低) markdownExport innerHTML → 改为 DOMParser
  - R2-P06(低) MemoMention.ts 废弃文件 → 已删除
- **构建验证**：vite build 通过，exit code 0，18.10s

## 第四轮安全与性能审计（2026-07-11 PM）
- **报告位置**：`public/test-reports/v1.3.0-security-perf-audit-r3.html`
- **结果**：0 严重 / 0 高 / 3 中 / 9 低 / 52 已通过
- **新发现 12 项**（无 Critical/High）：
  - R3-P02(中高) handleLogout 未清理 Pinia store → 跨用户数据残留
  - R3-P01(中) memoStorage 事件监听器泄漏 → 重复添加
  - R3-P03(中) Supabase 查询未用 select= → 返回冗余字段
  - R3-S01(低) localStorage key 硬编码项目 ID
  - R3-P04(低) closeCrossTabSync 破坏重新登录后入站同步
  - R3-P05(低) useTheme mediaQuery 监听器未清理
  - R3-P06(低) 短时 setTimeout 未清理
  - R3-P07(低) onTaskDoneCallback 未 logout 清除
  - R3-P08(低) reorderMemo N+1 查询
  - R3-P09(低) 查询无 limit 参数
  - R3-P10(低) vite.config mention 死代码
  - R3-S02(低) hybrid.ts 500 行死代码（保留）

## 第四轮安全与性能审计（2026-07-11）
- **报告位置**：`public/test-reports/v1.3.0-security-perf-audit-r4.html`
- **发现问题**：10 项（0 严重 / 0 高 / 2 中 / 8 低）+ 55 项已通过
- **R4-P01 (中)**：handleLogout 未调用 flushGrowthToCloud，Growth 数据 2s 防抖窗口内丢失
- **R4-S01 (中)**：console_sync_fix.js 硬编码用户 UUID + Supabase 凭据，未在 .gitignore 中
- **R4-P02~P05 (低)**：task.ts 匿名监听器、ToggleExtension 匿名监听器、auth 订阅未取消、MemoView deep watch
- **R4-S02~S05 (低)**：DOMPurify ADD_ATTR: ['*'] 过宽、Mermaid style 标签、markdownExport 未转义、CSP wasm-unsafe-eval 可能多余
- **四轮累计**：3 严重 + 8 高 + 15 中 + 15 低 = 41 项已修复，10 项新发现待处理
- **全部 10 项已修复**：R4-P01 flushGrowthToCloud + R4-P02 cleanupTaskListeners + R4-P03 ToggleExtension destroy + R4-P04 auth.cleanup + R4-P05 移除 deep watch + R4-S01 删除调试脚本 + R4-S02 DOMPurify 收紧 + R4-S03 保留 + R4-S04 HTML 转义 + R4-S05 CSP 注释

## 第五轮安全与性能审计（2026-07-11）
- **报告位置**：`public/test-reports/v1.3.0-security-perf-audit-r5.html`
- **发现问题**：6 项（0 严重 / 0 高 / 0 中 / 6 低）+ 65 项已通过
- **R4 修复验证**：10/10 全部通过
- **R5-S01 (低)**：MindmapNodeView SVG 未经 DOMPurify（缓解：HTML 剥离 + 可信库 + CSP）
- **R5-P01 (低)**：onCrossTabSync 返回值未捕获（页面重载自然清理）
- **R5-P02 (低)**：onTaskDoneCallback 异步未 catch（潜在未处理 rejection）
- **R5-P03 (低)**：loadPromise 失败后不重置
- **R5-P04 (低)**：无全局错误处理器
- **R5-S02 (低)**：图片拖放接受 SVG（Canvas 压缩可能跳过小文件）
- **五轮累计**：55 项已修复，6 项新发现（全部低风险），4 项暂缓
- **全部 6 项已修复**：R5-S01 sanitizeSvg + R5-P01 unsubCrossTab 捕获 + R5-P02 Promise.resolve().catch() + R5-P03 loadPromise catch 重置 + R5-P04 全局错误处理器 + R5-S02 排除 SVG
- **构建验证**：vite build 通过，exit code 0，21.88s
- **四轮暂缓项保留**：R3-P03 select=、R3-P06 setTimeout、R3-P08 N+1、R3-S02 死代码
- Bucket: `cleannote_attachments`（Public），路径 `memo/{userId}/{randomUUID}-{safeName}`
- RLS: 公开读取 + `auth.uid()` 隔离写入/删除
- 函数：`supabaseUploadAttachment` / `supabaseGetPublicUrl` / `supabaseDeleteAttachment` / `supabaseCreateSignedUrl`
- 迁移 SQL: `migration-attachments-rls-update.sql`（x-user-id → auth.uid()）
- 文件上传 MIME 白名单：19 种安全类型（pdf/docx/xlsx/pptx/txt/csv/md/json/xml/zip/rar/7z/mp3/mp4/wav/flac 等）
- 路径用 `crypto.randomUUID()` 增强熵值（122 bits），防止路径遍历猜测

## 全面功能测试（2026-07-12）
- **报告位置**：`public/test-reports/v1.3.0-functional-test-report.html`
- **测试团队**：4 名测试员并行（tester-tasks / tester-auth / tester-memos / tester-security-perf）
- **总计**：164 项测试用例，146 通过(89.0%)，12 未通过
- **去重缺陷**：17 项（1高 / 5中 / 10低 / 1提示）
- **P0 必修**：DEF-01 AI taskId.startsWith() 模糊匹配 → 精确匹配
- **P1 建议**：DEF-02 登出 flush 顺序错误（auth.logout 先于 flush）/ DEF-03 growthStorage 缺 visibilitychange flush
- **P2 迭代**：DEF-04 cycleStatus 检查不一致 / DEF-05 周报AI失败静默 / DEF-06 deleteMemoById 无重试
- **性能实测**：入口chunk 106KB(gzip 36KB)，初始加载 131.5KB gzip，8个vendor分块+全懒加载
- **安全**：五轮审计修复项全部验证通过，DOMPurify/AES-GCM/CSP/RLS/MIME均正确

## 安全优化（2026-07-10）
- **S3.3+S5.2 文件附件**：MIME 白名单校验 + Storage 上传替代 base64 内嵌，失败回退 base64
- **S2.3 Storage 安全**：UUID 路径 + signed URL 函数（为 private bucket 迁移准备）
- **S6.1 XP 服务端校验**：RPC `cleannote_calculate_xp` (SECURITY DEFINER + auth.uid())，客户端优先 RPC 失败回退本地计算
- **迁移 SQL**: `migration-xp-verification-rpc.sql`（只访问 cleannote_tasks/growth 表，不影响其他数据库）
