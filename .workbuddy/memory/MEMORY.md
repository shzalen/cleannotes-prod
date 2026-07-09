# CleanNotes 项目记忆

## 项目基本信息
- 技术栈：Tauri 2.0 + Vue 3 + TypeScript + Pinia + TailwindCSS v4
- 主项目路径：`D:\CleanNotepad\v1.3.0\`（2026-07-03 从旧工作空间迁移至此）
- 旧工作空间 `D:\WorkBuddySpace\ZURU\2026-06-10-10-28-51\cleannotes\` 已搁置，将来手动废弃；all-in-one 适配副本已确认不需要，不再维护
- 应用名：清记
- 打包：NSIS 安装程序（零 exe 方案，依赖本机 Python + pywebview）
- 实际使用方式：dist 目录挂在 IIS 下，纯 Web 模式；每次修改后必须 `npx vite build` 才能生效
- **默认部署到 prod**：每次构建后，除非用户明确说"不要部署到 prod"，否则必须同步执行 `copy:prod` 等价流程（gh-pages 构建 → 覆盖 `D:/CleanNotepad-Prod/v1.3.0` → 重建本地 IIS dist）
- **构建时版本**：`vite.config.ts` 注入 `__APP_VERSION__`（package.json version）和 `__BUILD_TIME__`（YYYY-MM-DD HH:mm 格式化时间戳），侧栏底部显示
- **测试报告系统**：侧栏版本号点击打开 TestReportModal，从 `public/test-reports/*.json` 动态加载报告列表；新增版本只需添加 JSON 文件即可自动显示
- **Git 状态**：已 git init，remote 已配置 `https://github.com/shzalen/cleannotes.git`

## 暗黑模式架构
- CSS 自定义属性体系：`:root` 定义 ~40 个变量，`[data-theme="dark"]` 覆盖
- `composables/useTheme.ts`：mode(light/dark/auto/zuru) + isDark + localStorage + prefers-color-scheme
- `getDataTheme()` 返回 `'light'|'dark'|'zuru'` 字符串，zuru 时 isDark=false
- CSS: `[data-theme="zuru"]` 块覆盖全部变量为 ZURU 红白灰配色（primary #E53935 品牌红，bg/text/border 保持浅色）
- ZURU 左侧菜单保持浅色（与 light 一致），不跟随真实 ZURU 内部系统的黑色侧栏
- 脚本区颜色映射全部改为 computed 响应式（priorityColorMap/statusColorMap 等）
- SVG 内联颜色用 `:stroke`/`:fill` 绑定 computed 值
- 变量命名规范：`--color-{semantic}-{variant}`（如 --color-danger-light, --color-accent-text）
- 新增交互状态变量：`--color-primary-hover`（按钮悬停）、`--color-primary-disabled`（按钮禁用）
- 登录页配色已统一为 success 色系 CSS 变量（与系统内部绿色基调一致），暗黑模式自动适配
- 半透明效果统一用 `color-mix(in srgb, var(--color-xxx) yy%, transparent)` 代替 rgba

## 关键约定
- **默认修改主项目**：所有改动一律针对 `D:\CleanNotepad\v1.3.0\`，无其他目标目录。
- hex 颜色不允许出现在 `.vue` 文件的 `<style>` 区域，必须用 CSS 变量
- 脚本中 `:style` 绑定的颜色需用 computed + isDark 响应式
- **html2canvas-pro CSS 变量问题**：html2canvas 内部解析器无法处理 `var(--color-*)` 和 `color-mix()`，导出时需在 `onclone` 回调中用 `getComputedStyle` 预收集实际值并内联到克隆 DOM，同时注入 `:root` 解析后的 CSS 变量值
- **周报 AI 总结两阶段生成**：generateReport() 同步返回（AI 占位 generating），generateAiSummary() 后台异步更新（success/failed）。三种 HTML 状态占位：generating=shimmer+"正在生成中，请稍后查看"、failed=✕icon+"暂不可用"、success=实际内容
- **AI 智能总结**：周报生成时尝试调用 AI（复用 aiStore 配置），失败静默跳过，不影响周报生成。`generateReport` 改为 async。
- 存储层：hybridAdapter（离线优先 + Supabase 云端同步）
- Supabase 表名前缀：`cleannote_`
- 用户隔离：localStorage 键含 userId，Supabase 查询含 user_id 过滤
- **时间戳统一为 UTC ISO（带 Z 后缀）**：所有 TIMESTAMPTZ 字段使用 `toUTCISO()` (= `new Date().toISOString()`)，不再用 `toLocalISO()`（旧格式无 Z 后缀，PG 当 UTC 存导致多 8 小时偏移）
- **`normalizeTimestamp()`** 防护函数：supabase.ts 所有 TIMESTAMPTZ 字段写入前走此函数，对旧无 Z 格式数据自动转 UTC
- 显示端用 `new Date(ts).getHours()` 自动 UTC→本地时区转换，兼容新旧格式
- 迁移标记：`cleannotes_time_migrated_v5`（App.vue 启动时自动将旧 localStorage 数据转为 UTC ISO）
- Task 新增 `inProgressAt: string | null` 字段（UTC ISO TIMESTAMPTZ 格式），在任务进入"进行中"状态时自动记录，用于计算执行耗时
- 耗时公式：`completedAt - inProgressAt`（仅 status=done 时展示）；已完成任务重新激活不清除历史，再次执行时覆盖
- 已完成→待办切换需确认：store.reactivateConfirm + requestToggleStatus/confirmReactivate/cancelReactivate；编辑弹窗 save() 中也有独立确认
- DB 字段映射：`inProgressAt` ↔ `in_progress_at`（Task/DeletedTask 四组转换函数，supabase.ts）
- 耗时格式化：`formatDuration(task)` 函数（在 `src/stores/task.ts`），支持秒/分钟/小时分级显示

## 养成系统（烛）
- 意象变更：从五阶树改为「烛」——火焰=等级，光晕=活力，蜡烛体=累计经验
- 原因：树形态过于复杂不适合办公室场景，烛简化至3维度6个SVG元素
- 状态三态：活力(vitality) / 倦意(withered) / 复苏(recovery)
- 火焰高度：Lv.1=14px → Lv.50=30px，线性映射
- 光晕半径：vitality=30 / recovery=22 / withered=14
- 视觉打磨（已完成）：SVG 渐变填充（火焰三层 linearGradient、光晕 radialGradient、蜡烛体渐变）、火焰摇曳 CSS 动画（三层各自频率）、光晕脉动、融化弧/蜡滴/烛芯细节、进度条渐变光泽、成就分类色系与圆点状态标记、XpToast 火焰图标与来源标签色、侧栏烛图标半透明填充风格
- 经验值：完成10+高优先+5+凌晨+3+准时+5+连续N×2，升级公式 N×20 XP
- 成就四门类：里程碑(破土→林海)/连续(春风→岁寒)/特殊(星光/时钟/巧手/满月)/隐藏(枯木逢春/从头再来/星河入梦)
- 日级状态：活力→倦意(连续2天未完成) / 倦意→复苏(完成1个任务) / 复苏→活力(连续2天完成)
- 反馈原则：XpToast 3秒消失不打断操作，成就解锁静态标记
- 存储：独立 growthStorage.ts（localStorage，遵循 `cleannotes_{userId}_growth_*` 前缀）
- Store：growth.ts Pinia Store，通过 setOnTaskDone 回调与 taskStore 集成
- 路由：/spirit 详情页
- 侧边栏：新增「烛」导航项
- 热力图架构：TaskHeatmap.vue 内联 computed 直接访问 store.tasks（不通过 store.getHeatmapData 普通函数，确保 Pinia v3 响应式追踪）；空格子加 outline 边框确保可见；HomeView 加 v-if="store.loaded" 保护

## 待办事项模块（Todo）
- 数据模型：TodoItem（id, title, description, estimatedStart, estimatedEnd, linkedTaskId, createdAt, updatedAt）
- 存储：todoStorage.ts 离线优先（localStorage + Supabase）
- Store：todo.ts（activeTodos computed 过滤已转任务的条目）
- Supabase 表：cleannote_todos
- 转任务：通过 TaskEditModal.openFromTodo() 预填表单
- 删除确认：ConfirmDialog danger 类型

## 备忘录模块（Memo）
- 数据模型：MemoItem（id, title, content, tags[], pinned, createdAt, updatedAt）
- content 字段存储 HTML 富文本内容（Tiptap 编辑器输出）
- 存储：memoStorage.ts 离线优先（localStorage + Supabase），遵循 `cleannotes_{userId}_memos` 前缀
- Store：memo.ts（pinnedMemos/normalMemos 分离、searchQuery + activeTag 筛选、allTags 自动收集）
- Supabase 表：cleannote_memos（SQL: migration-memos.sql）
- SQL 迁移文件：migration-memos.sql（建表+RLS），migration-attachments-storage.sql（Storage bucket+RLS）
- 视图：MemoView.vue（2026-06-25 重构）— **左右分栏布局**，左侧 300px 标题列表（快捷记录栏、搜索、标签筛选、置顶区+全部区、hover 操作按钮），右侧大编辑区（大号标题输入 + RichTextEditor + 标签编辑 + 创建/更新时间）。**800ms 防抖自动保存**，无需手动点保存。新建时先进入 isCreating 态，首次自动保存后在 store 创建并获取真实 ID。切换选中/离开页面前 flush 保存。已废弃 MemoEditModal 弹窗模式。
- 删除确认：ConfirmDialog danger 类型
- 路由：/memos，侧栏图标：文档

### 富文本编辑器（RichTextEditor.vue）— Notion 风格（2026-06-25 重构）
- 基于 Tiptap（@tiptap/vue-3 + starter-kit + extension-image + extension-link + extension-placeholder + 自定义 SlashCommand 扩展）
- **无固定工具栏**——已彻底移除，替换为三个新交互模式：
  1. **浮动气泡菜单**（纯 Vue 实现，无 tippy 依赖）：选中文字后 mouseup 触发，显示 B/I/S/</>/link 按钮，mousedown 在编辑器外隐藏
  2. **斜杠命令面板**（自定义 ProseMirror Plugin `SlashCommand.ts`）：段落开头输入 `/` 触发，可搜索筛选 9 种块类型（文本/H1/H2/H3/无序/有序/引用/分割线/代码块），键盘 ↑↓ Enter 确认
  3. **+ 快速插入按钮**：hover 编辑区出现，点击插新段落 + 打开斜杠面板
- v-model 双向绑定 HTML 字符串
- **图片上传**：FileReader → base64 data URL → `setImage()` 直接嵌入（allowBase64: true）
- **文件上传**：FileReader → base64 data URL → `insertFileAttachment()` 嵌入下载链接
- 大小限制：5MB，超限弹 alert
- 不依赖 Supabase Storage，所有附件直接编码嵌入 HTML 内容，完全自包含
- `src/extensions/SlashCommand.ts` — 导出 SlashCommand Extension、slashCommandPluginKey、SLASH_ITEMS、openSlashAtCursor()
  4. **Mermaid 图表**（2026-06-30 新增）：输入 `/mermaid` 或通过斜杠面板选择插入。支持流程图、时序图、思维导图、甘特图等全部 Mermaid 图表类型。
  5. **Mermaid 编辑模态弹窗**：hover 图表显示编辑/删除工具栏；双击或点击编辑打开左右分栏模态（代码编辑器 + 实时预览）；底部模板快速切换（流程图/时序图/思维导图）；主题自动跟随系统暗黑/浅色模式。
- Mermaid 相关文件：`src/extensions/MermaidExtension.ts`（Tiptap 节点扩展）、`src/components/MermaidNodeView.vue`（VueNodeView 组件）
- Mermaid 依赖：通过动态 import 实现代码分割，独立 chunk 约 606KB，不影响初始加载
  6. **XMind 风格思维导图**（2026-06-30 新增）：输入 `/mindmap` 或通过斜杠面板选择插入。使用 markmap-lib + markmap-view 渲染，Markdown 标题语法（# ## ###）构建层级。
- Mindmap 相关文件：`src/extensions/MindmapExtension.ts`（Tiptap 节点扩展）、`src/components/MindmapNodeView.vue`（markmap VueNodeView 组件）
- Mindmap 特性：点击节点折叠/展开、拖拽平移、滚轮缩放、hover 工具栏（编辑/适应画面/放大/缩小/删除）、编辑模态（Markdown textarea + markmap 实时预览）、10 个模板、双向 resize、Tab 缩进

### Supabase Storage
- Bucket: `cleannote_attachments`（需在 Dashboard 手动创建，Public bucket）
- 上传函数：supabaseUploadAttachment(file) → FormData POST
- 公开 URL：supabaseGetPublicUrl(path) → `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`
- 删除函数：supabaseDeleteAttachment(path)
- RLS: 公开读取 + 用户隔离写入/删除（通过 x-user-id header）
- **当前未使用**：RichTextEditor 改用 base64 内嵌，不依赖 Storage

## 删除操作公约（全局）
- **所有删除操作必须先弹 ConfirmDialog 确认，不能直接删除**
- 例外：仅当用户明确说"直接删除"或"不用确认"时才可以跳过
- 确认弹窗使用 `ConfirmDialog` 组件，type="danger"，显示被删除项名称
