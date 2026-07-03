# 清记

个人任务管理与笔记应用，兼顾效率与成长追踪。

## 技术栈

| 层级 | 技术 | 
|------|------| 
| 前端框架 | Vue 3 + TypeScript |
| 构建工具 | Vite 6 |
| 状态管理 | Pinia |
| CSS 框架 | TailwindCSS v4 |
| 富文本编辑器 | Tiptap 3 |
| 桌面端 | Tauri 2 |
| 云端存储 | Supabase |
| 包管理 | npm |

## 功能模块

### 任务管理
- 任务 CRUD，支持优先级、标签、截止日期、时间段
- 看板状态流转（待办 → 进行中 → 已完成）
- 执行耗时自动计算（inProgressAt → completedAt）
- 回收站：7 天自动清理，支持恢复
- 日历热力图 + 趋势统计

### 待办事项
- 轻量级待办，支持重要性评级（1-5）
- 可转换为正式任务，预填表单

### 备忘录
- Notion 风格富文本编辑器（Tiptap）
- 斜杠命令面板（/ 触发）：标题、列表、引用、代码块、分割线
- Mermaid 图表编辑与实时预览（流程图、时序图、思维导图等）
- Markmap 思维导图（Markdown 语法，拖拽缩放，折叠/展开）
- 图片插入、附件嵌入、链接
- 浮动气泡菜单（选中文字触发）
- 标签分类、置顶、搜索筛选
- 左右分栏布局，800ms 防抖自动保存

### 成长系统（烛）
- 等级经验值：完成任务获取 XP，等级公式 N×20 XP
- 连续天数追踪：连续完成可获得额外 XP 加成
- 三态切换：活力(vitality) / 倦意(withered) / 复苏(recovery)
- 成就系统：里程碑、连续、特殊、隐藏四大门类
- 可视化：SVG 蜡烛火焰动画 + 光晕脉动

### AI 助手
- 对话式 AI 交互
- 支持自定义 API 地址与模型

### 诊断工具
- Ctrl+Shift+D 打开诊断页
- 查看存储状态、同步日志、构建信息

## 多主题

| 主题 | 标识 | 主色调 |
|------|------|--------|
| 默认浅色 | `light` | `#4f6cf7` 蓝紫 |
| 深色 | `dark` | 自适应暗色 |
| ZURU | `zuru` | `#E53935` 品牌红 |
| Tencent | `tencent` | `#0052D9` 腾讯蓝 |

通过 40+ CSS 自定义属性驱动，`data-theme` 属性切换，支持 system 自动跟随。

## 存储架构

```
┌─────────────────────────┐
│      混合存储适配器       │
│    (hybridAdapter)       │
├───────────┬─────────────┤
│  本地存储  │  云端存储    │
│ localStorage │ Supabase   │
└───────────┴─────────────┘
```

- **离线优先**：所有操作先写入 localStorage，后台同步至 Supabase
- **用户隔离**：localStorage 键含 userId 前缀，Supabase 查询含 user_id 过滤
- **自动合并**：登录后自动合并本地与云端数据

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 访问 http://localhost:1420

# 构建生产版本
npm run build
# 输出到 dist/

# 预览构建结果
npm run preview
```

### 环境变量

Supabase 配置位于 `src/services/supabase.ts`。生产环境建议迁移至 `.env` 文件：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key
```

## 构建与部署

### Web 模式

构建产物在 `dist/` 目录，可直接部署到任意静态服务器（Nginx、IIS、CDN）。

```bash
npm run build
```

### 桌面应用（Tauri）

需要 Rust 开发环境：

```bash
npm run build
cd src-tauri
cargo tauri build
# 输出在 src-tauri/target/release/bundle/
```

### 包分析

```bash
ANALYZE=true npm run build
# 生成 dist/stats.html
```

## 项目结构

```
src/
├── main.ts                    # 应用入口
├── App.vue                    # 根组件（布局 + 初始化）
├── style.css                  # 全局样式 + 主题变量
├── router/index.ts            # 路由配置
├── components/                # 可复用组件
│   ├── AppSidebar.vue         # 侧边栏导航
│   ├── ConfirmDialog.vue      # 确认对话框
│   ├── RichTextEditor.vue     # 富文本编辑器（核心）
│   ├── MermaidNodeView.vue    # Mermaid 图表渲染
│   ├── MindmapNodeView.vue    # 思维导图渲染
│   ├── TaskCalendar.vue       # 任务日历
│   ├── TaskHeatmap.vue        # 热力图
│   ├── TaskTrendChart.vue     # 趋势统计
│   ├── SpiritWidget.vue       # 成长系统可视化
│   ├── XpToast.vue            # XP 获取提示
│   ├── AiChat.vue             # AI 对话
│   └── TestReportModal.vue    # 测试报告弹窗
├── composables/               # 组合式函数
│   ├── useTheme.ts            # 主题切换
│   └── useSync.ts             # 数据同步
├── extensions/                # Tiptap 扩展
│   ├── SlashCommand.ts        # 斜杠命令
│   ├── MermaidExtension.ts    # Mermaid 节点
│   └── MindmapExtension.ts    # 思维导图节点
├── services/                  # 服务层
│   ├── hybrid.ts              # 混合存储
│   ├── supabase.ts            # Supabase 客户端
│   └── growthStorage.ts       # 成长系统存储
├── stores/                    # Pinia 状态管理
│   ├── task.ts                # 任务
│   ├── todo.ts                # 待办
│   ├── memo.ts                # 备忘录
│   ├── growth.ts              # 成长系统
│   ├── auth.ts                # 认证
│   ├── ai.ts                  # AI
│   └── timer.ts               # 计时器
├── views/                     # 页面视图
│   ├── HomeView.vue           # 首页
│   ├── TasksView.vue          # 任务
│   ├── TodoView.vue           # 待办
│   ├── MemoView.vue           # 备忘录
│   ├── SpiritView.vue         # 成长详情
│   ├── AiView.vue             # AI 助手
│   ├── SettingsView.vue       # 设置
│   ├── DiagView.vue           # 诊断
│   └── LoginView.vue          # 登录
└── types/index.ts             # 类型定义
```

## 开发约定

- **颜色**：禁止在 `.vue` 文件的 `<style>` 中使用 hex 颜色，统一使用 CSS 变量
- **删除操作**：所有删除必须先弹出 `ConfirmDialog` 确认，除非用户明确要求跳过
- **构建**：修改代码后必须执行 `npx vite build`，dist 挂在 IIS 下使用
- **边界框**：Mermaid 图表、思维导图、图片三者 hover 使用统一的 `1px border + 1px box-shadow`（共 2px `--color-border-light`）

## License

Private
