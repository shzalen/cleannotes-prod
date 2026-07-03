# 清记 (CleanNotes)

个人效率工具，集任务管理、备忘录、待办事项与养成系统于一体。

## 技术栈

- **框架**：Tauri 2.0 + Vue 3 + TypeScript
- **状态管理**：Pinia v3
- **样式**：TailwindCSS v4
- **富文本编辑**：Tiptap（Notion 风格，无固定工具栏）
- **图表渲染**：Mermaid + markmap（思维导图）
- **存储**：hybridAdapter（localStorage 离线优先 + Supabase 云端同步）
- **构建**：Vite 6

## 功能模块

### 任务管理
- 优先级 / 状态 / 标签多维分类
- 进行中任务自动计时，完成时展示执行耗时
- 热力图可视化每日任务完成情况
- 已完成任务重新激活需确认，防误操作

### 备忘录
- 基于 Tiptap 的 Notion 风格富文本编辑器
- 斜杠命令面板（`/`）快速插入 9 种块类型
- 浮动气泡菜单（选中文字触发格式化）
- 内置 Mermaid 图表（流程图、时序图、甘特图等）
- 内置 Markmap 思维导图（Markdown 语法构建层级）
- 图片 / 文件 base64 内嵌，无需外部存储
- 左右分栏布局，800ms 防抖自动保存

### 待办事项
- 可关联转为任务，预填表单信息
- 离线优先 + 云端同步

### 养成系统（烛）
- 完成任务的 XP 经验值累积与等级成长
- 日级三态：活力 / 倦意 / 复苏
- 四门类成就系统：里程碑、连续、特殊、隐藏
- 烛意象 SVG 可视化（火焰 + 光晕 + 蜡烛体）

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run start
```

## 部署

`dist/` 目录直接挂载到 IIS 或其他静态文件服务器即可运行，纯 Web 模式无需 Tauri 运行时。

每次修改代码后必须执行 `npm run build` 重新构建才能生效。

## 项目结构

```
v1.3.0/
├── src/
│   ├── components/        # Vue 组件
│   │   ├── RichTextEditor.vue   # Tiptap 富文本编辑器
│   │   ├── MermaidNodeView.vue   # Mermaid 图表节点
│   │   └── MindmapNodeView.vue   # 思维导图节点
│   ├── extensions/        # Tiptap 自定义扩展
│   │   ├── SlashCommand.ts       # 斜杠命令面板
│   │   ├── MermaidExtension.ts   # Mermaid 节点扩展
│   │   └── MindmapExtension.ts   # 思维导图节点扩展
│   ├── composables/       # 组合式函数
│   │   └── useTheme.ts          # 主题管理（light/dark/auto/zuru）
│   ├── stores/            # Pinia Store
│   │   ├── task.ts
│   │   ├── memo.ts
│   │   ├── todo.ts
│   │   └── growth.ts
│   ├── views/             # 路由视图
│   │   ├── HomeView.vue
│   │   ├── TasksView.vue
│   │   ├── MemoView.vue
│   │   ├── TodoView.vue
│   │   ├── SpiritView.vue
│   │   └── ...
│   └── router/            # 路由配置
├── public/
│   └── test-reports/      # 测试报告 JSON（侧栏动态加载）
├── dist/                  # 构建输出（IIS 部署目录）
├── vite.config.ts
└── package.json
```

## 关键约定

- 所有 `.vue` 文件 `<style>` 区域不得出现 hex 颜色，必须使用 CSS 变量
- 时间戳统一为 UTC ISO 格式（`new Date().toISOString()` 带 Z 后缀）
- 删除操作必须先弹 ConfirmDialog 确认，不得直接删除
- 暗黑模式通过 CSS 自定义属性 `[data-theme="dark"]` 切换
