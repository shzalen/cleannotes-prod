# CleanNotes（清记）产品需求文档 v1.3.0

> 本文档基于 v1.3.0 源代码反向工程提取，所有功能规格均来自实际代码实现。

## 1. 产品概述

### 1.1 产品定位与核心价值主张

CleanNotes（清记）是一款**融合任务管理、游戏化养成与 AI 智能助手的个人效率工具**。核心价值主张：

- **极简不简陋**：清爽界面承载完整功能——任务、备忘、待办、周报、AI 一站式覆盖
- **烛光养成**：以"烛"（Candle）为隐喻的任务完成激励系统，让坚持可量化、可感知
- **AI 协作**：内置 OpenAI 兼容 API 的智能助手，可查看、创建、修改、删除任务，带用户确认的安全机制
- **跨端体验**：PC 端富交互 + H5 移动端精简视图，自动设备适配，一套数据两端可用

### 1.2 目标用户画像

| 维度 | 描述 |
|------|------|
| 职业 | 个人开发者、自由职业者、产品经理、知识工作者 |
| 场景 | 日常任务管理、项目进度追踪、备忘记录、周报生成 |
| 痛点 | 任务工具功能碎片化、缺乏长期坚持的激励机制、周报编写重复枯燥 |
| 期望 | 一个轻量但完整的工具，既有秩序感又不压迫感 |

### 1.3 产品愿景

让每个人在清简的界面中保持专注，在烛光的微亮中积累习惯，在 AI 的协助中高效前行。

---

## 2. 功能全景图

```
CleanNotes v1.3.0
├── 核心生产力
│   ├── 3.1 任务管理 — 以状态流转驱动的项目级任务中心
│   ├── 3.2 备忘录 — 富文本笔记卡片，支持置顶/标签/拖拽排序
│   └── 3.3 待办事项 — 轻量想法收集池，可一键升级为正式任务
├── 激励系统
│   ├── 3.4 养成系统（烛） — XP/等级/连续/成就的游戏化养成引擎
│   └── 3.5 周报系统 — 自动统计数据 + AI 智能总结的周期复盘
├── 智能增强
│   └── 3.6 AI 智能助手 — OpenAI 兼容对话式助手，支持 Function Calling
├── 基础设施
│   ├── 3.7 主题系统 — 腾讯蓝/暗夜/自动/紫语四种主题
│   ├── 3.8 用户认证 — 手机号 + 密码注册登录，验证码注册双模式
│   ├── 3.9 数据同步 — Supabase 增量同步，30秒轮询 + Health Check
│   └── 3.10 富文本编辑器 — 基于 TipTap 的 Markdown+富文本混合编辑器
├── 体验层
│   ├── 3.11 移动端适配 — H5 精简视图 + PC/H5 自动路由分发
│   └── 3.12 时间线/计时器 — 工作时段倒计时 + 任务时间节点展示
```

---

## 3. 功能需求详述

### 3.1 任务管理

#### 功能描述

任务管理是 CleanNotes 的核心模块，提供完整的三态（待办 → 进行中 → 已完成）任务生命周期管理，包括优先级分级、截止日期、计划开始时间/日期、标签分类、回收站机制、热力图可视化等功能。

#### 用户故事

- 作为项目经理，我需要创建带优先级和截止日期的任务，以便有序推进工作
- 作为知识工作者，我需要在完成任务后将其标记为"已完成"，以便追踪进度
- 作为用户，我需要将误删的任务从回收站恢复，7天内有效
- 作为长期使用者，我需要通过热力图回顾自己的任务分布规律

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 创建任务 | 设置标题、描述、优先级(low/medium/high)、截止日期、计划开始日期+时间、标签 | `task.ts:addTask` |
| 2 | 状态流转 | 待办 → 进行中 → 已完成，循环切换 | `task.ts:toggleStatus/requestToggleStatus` |
| 3 | 完成确认 | 已完成任务重新激活需二次确认弹窗 | `task.ts:reactivateConfirm` |
| 4 | 编辑任务 | 修改标题、描述、状态、优先级、截止日期、开始时间、标签 | `task.ts:updateTask` |
| 5 | 删除任务 | 未完成任务可删除，移入回收站；已完成任务不可删除 | `task.ts:deleteTask` |
| 6 | 回收站 | 删除后7天保留期，到期自动清除；支持恢复/永久删除/清空 | `task.ts:trash/purgeExpired` |
| 7 | 即将过期提示 | 回收站中3天内即将永久删除的任务标记 | `task.ts:expiringTrash` |
| 8 | 墓碑机制 | 永久删除的任务记录墓碑ID，防止同步时被意外恢复 | `task.ts:addTombstones` |
| 9 | 热力图 | 年/月/周视图，展示每日任务数量分布（5级颜色梯度） | `task.ts:getHeatmapData` |
| 10 | 执行耗时 | 自动计算进行中→已完成的耗时，格式化显示 | `task.ts:formatDuration` |
| 11 | 最近任务 | 展示最近更新的8个任务 | `task.ts:recentTasks` |
| 12 | 状态分组 | 按待办/进行中/已完成分组展示 | `task.ts:todoTasks/inProgressTasks/doneTasks` |

#### 数据模型简述

```typescript
Task {
  id: string              // 时间戳+随机数生成
  title: string           // 任务标题
  description: string     // 任务描述（富文本）
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null  // 截止日期 YYYY-MM-DD
  startDate: string | null // 计划开始日期 YYYY-MM-DD
  startTime: string | null // 计划开始时间 HH:mm
  tags: string[]          // 标签列表
  createdAt: string       // UTC ISO 创建时间
  updatedAt: string       // UTC ISO 更新时间
  completedAt: string | null // 完成时间（自动填充）
  inProgressAt: string | null // 进入进行中的时间（自动填充）
}

DeletedTask extends Task {
  deletedAt: string       // 删除时间 ISO
}
```

---

### 3.2 备忘录

#### 功能描述

备忘录模块提供富文本笔记卡片管理，支持标题+内容编辑、标签分类、置顶标记、自定义图标（emoji）、拖拽排序。置顶与普通分组独立排序。

#### 用户故事

- 作为记录者，我需要创建带标签的备忘卡片，以便快速分类查找
- 作为使用者，我需要将重要备忘置顶，以便第一时间看到
- 作为整理者，我需要拖拽调整备忘顺序，以便按优先级排列

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 创建备忘 | 标题、富文本内容、标签、置顶标记、图标(emoji) | `memo.ts:addMemo` |
| 2 | 编辑备忘 | 修改标题、内容、标签、置顶、图标 | `memo.ts:updateMemo` |
| 3 | 置顶切换 | 一键置顶/取消置顶，置顶后自动排在置顶组最前 | `memo.ts:togglePin` |
| 4 | 删除备忘 | 直接删除（无回收站） | `memo.ts:removeMemo` |
| 5 | 搜索过滤 | 按关键词搜索标题/内容/标签 | `memo.ts:filteredMemos` |
| 6 | 标签筛选 | 按标签过滤展示 | `memo.ts:activeTag/allTags` |
| 7 | 拖拽排序 | 置顶组和普通组独立排序，stride=1000减少级联更新 | `memo.ts:reorderMemo` |
| 8 | sortOrder迁移 | 无sortOrder的遗留数据自动迁移 | `memo.ts:migrateSortOrder` |
| 9 | 分组展示 | 置顶组 + 普通组分开展示，组内按sortOrder升序 | `memo.ts:pinnedMemos/normalMemos` |

#### 数据模型简述

```typescript
MemoItem {
  id: string
  title: string
  content: string          // 富文本HTML内容
  tags: string[]
  pinned: boolean          // 是否置顶
  icon: string             // emoji图标
  sortOrder: number        // 排序权重，越小越靠前
  createdAt: string
  updatedAt: string
}
```

---

### 3.3 待办事项

#### 功能描述

待办事项是轻量级的想法收集池，与任务管理互补。待办可设置重要等级(1-5)、预计开始/结束日期，支持一键升级为正式任务（转换后关联linkedTaskId，从活跃列表隐藏）。

#### 用户故事

- 作为想法捕捉者，我需要快速记录一个待办想法，不立刻进入正式任务流程
- 作为计划者，我需要将待办升级为正式任务，以便开始执行和追踪
- 作为整理者，我需要按重要等级排列待办，以便优先处理最重要的事项

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 创建待办 | 标题、描述、预计开始日期、预计结束日期、重要等级(0-5) | `todo.ts:addTodo` |
| 2 | 编辑待办 | 修改标题、描述、预计日期、重要等级 | `todo.ts:updateTodo` |
| 3 | 删除待办 | 直接删除 | `todo.ts:removeTodo` |
| 4 | 转任务 | 一键将待办转为正式任务，设置linkedTaskId，从活跃列表隐藏 | `todo.ts:markConverted` |
| 5 | 活跃列表 | 仅显示未转任务的待办，按重要等级降序、有日期优先 | `todo.ts:activeTodos` |
| 6 | 日期映射 | estimatedStart → startDate，estimatedEnd → dueDate（转任务时） | `types/index.ts:TodoItem注释` |

#### 数据模型简述

```typescript
TodoItem {
  id: string
  title: string
  description: string
  estimatedStart: string | null  // 预计开始日期 YYYY-MM-DD
  estimatedEnd: string | null    // 预计结束日期 YYYY-MM-DD
  linkedTaskId: string | null    // 转任务后关联的任务ID
  importance: number             // 重要等级 1-5，0=未评级
  createdAt: string
  updatedAt: string
}
```

---

### 3.4 养成系统（烛）

#### 功能描述

养成系统以"烛"（Candle）为隐喻，通过 XP 经验值、等级、连续天数、日状态（活力/倦意/复苏）、成就徽章构建游戏化激励机制。完成任务获得XP，连续完成提升连续天数，倦意态鼓励回归，成就解锁带来惊喜。

#### 用户故事

- 作为使用者，我需要在完成任务时获得XP反馈，以便感受到进度积累
- 作为坚持者，我需要看到自己的连续天数，以便保持习惯
- 作为倦怠者，我需要从"倦意态"恢复时获得"复苏态"的正向反馈
- 作为探索者，我需要解锁隐藏成就，以便发现惊喜

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | XP计算 | 基础10XP + 高优先+5 + 凌晨(0-6点)+3 + 截止日当天+5 + 连续天数×2 | `growth.ts:calculateXp` |
| 2 | 等级升级 | Lv.N→Lv.N+1 需要 N×20 XP，溢出自动累计 | `growth.ts:xpToNextLevel` |
| 3 | 连续天数 | 昨天有活动+1，中断归零；记录最大连续天数 | `growth.ts:refreshDailyState` |
| 4 | 日状态 | 活力(vitality)/倦意(withered)/复苏(recovery)三种状态 | `growth.ts:DailyState` |
| 5 | 状态转换 | 连续→活力；中断多天→倦意(witheredDays累加)；从倦意恢复→复苏 | `growth.ts:refreshDailyState` |
| 6 | 活力判定 | 今日完成3+个任务→活力态；倦意态完成1个→复苏态 | `growth.ts:applyXp` |
| 7 | 烛寄语 | 根据日状态随机展示寄语（活力/倦意/复苏各有3条） | `growth.ts:dailyMessage` |
| 8 | 成就系统 | 15个成就：5里程碑+4连续+4特殊+3隐藏 | `growth.ts:ACHIEVEMENTS` |
| 9 | 成就解锁 | 自动检查条件，解锁时+20XP + Toast通知 | `growth.ts:checkAchievements` |
| 10 | 隐藏成就 | 枯木逢春(倦意后连续3天)、从头再来(条件不公开)、星河入梦(连续3天凌晨) | `growth.ts:ACHIEVEMENTS` |
| 11 | XP Toast | 完成任务时弹出XP获得通知 | `growth.ts:showXpToast` |
| 12 | 升级 Toast | 升级时弹出等级提升通知 | `growth.ts:showLevelUpToast` |
| 13 | 成就 Toast | 解锁成就时弹出通知 | `growth.ts:showAchievementToast` |

#### 成就列表

| ID | 名称 | 描述 | 类别 | 条件 |
|----|------|------|------|------|
| milestone_1 | 破土 | 完成1个任务 | 里程碑 | totalDone>=1 |
| milestone_50 | 扎根 | 完成50个任务 | 里程碑 | totalDone>=50 |
| milestone_200 | 深根 | 完成200个任务 | 里程碑 | totalDone>=200 |
| milestone_500 | 参天 | 完成500个任务 | 里程碑 | totalDone>=500 |
| milestone_1000 | 林海 | 完成1000个任务 | 里程碑 | totalDone>=1000 |
| streak_7 | 春风 | 连续7天完成任务 | 连续 | maxStreak>=7 |
| streak_30 | 夏雨 | 连续30天完成任务 | 连续 | maxStreak>=30 |
| streak_100 | 秋实 | 连续100天完成任务 | 连续 | maxStreak>=100 |
| streak_365 | 寒 | 连续365天完成任务 | 连续 | maxStreak>=365 |
| special_night_10 | 星光 | 凌晨完成10个任务 | 特殊 | nightDone>=10 |
| special_deadline_20 | 时钟 | 截止日当天完成20个任务 | 特殊 | deadlineDone>=20 |
| special_daily_10 | 巧手 | 单日完成10个任务 | 特殊 | dailyDone>=10 |
| special_full_day | 满月 | 单日完成率100% | 特殊 | dailyRate==100 |
| hidden_revive | 枯木逢春 | 倦意态后连续3天完成 | 隐藏 | witheredThenRevive |
| hidden_restart | 从头再来 | 条件不公开 | 隐藏 | deleteThenCreate |
| hidden_night_3 | 星河入梦 | 条件不公开 | 隐藏 | nightStreak3 |

#### 数据模型简述

```typescript
GrowthState {
  level: number            // 当前等级
  xp: number               // 当前等级内XP
  totalXp: number          // 累计总XP
  streakDays: number       // 当前连续天数
  maxStreakDays: number    // 最大连续天数
  dailyState: 'vitality' | 'withered' | 'recovery'
  witheredDays: number     // 倦意累计天数
  lastActiveDate: string   // 最后活跃日期
  lastXpGainAt: string     // 最后XP获得时间
}

XpEvent {
  id: string
  taskId?: string
  source: 'complete' | 'priority' | 'night' | 'deadline' | 'streak' | 'achievement'
  xp: number
  createdAt: string
}

AchievementRecord {
  id: string               // 成就定义ID
  unlockedAt: string       // 解锁时间
}
```

---

### 3.5 周报系统

#### 功能描述

周报系统自动按周聚合任务/待办/XP数据，生成包含统计概览、本周完成任务、本周新增待办、待完成任务（下周跟进）的结构化HTML周报。支持AI智能总结（异步两阶段生成）。

#### 用户故事

- 作为管理者，我需要一键生成本周工作周报，而不是手工编写
- 作为复盘者，我需要查看完成率和连续天数，以便评估一周表现
- 作为AI使用者，我需要周报自动包含AI智能总结，以便获得深度分析

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 生成周报 | 按周一~周日聚合数据，立即生成基础内容 | `weeklyReport.ts:generateReport` |
| 2 | 统计概览 | 完成率、完成任务数、新增任务数、XP获得、连续天数、新增待办 | `weeklyReport.ts:buildSummary` |
| 3 | 完成率计算 | 完成数/max(新增数,完成数)，避免>100%异常值 | `weeklyReport.ts:buildSummary` |
| 4 | 本周完成任务表 | 含优先级badge、实际开始时间、耗时、完成日期 | `weeklyReport.ts:generateReportContent` |
| 5 | 新增待办列表 | 展示本周新增的待办事项 | `weeklyReport.ts` |
| 6 | 下周跟进 | 未完成任务按截止日期排序展示 | `weeklyReport.ts` |
| 7 | AI智能总结 | 两阶段：先占位"生成中"，再异步调用AI | `weeklyReport.ts:generateAiSummary` |
| 8 | AI状态管理 | generating/success/failed三种状态，失败时静默降级 | `weeklyReport.ts:aiSummaryStatus` |
| 9 | 周标签 | 自动计算"第N周(M/D - M/D)"格式 | `weeklyReport.ts:getWeekLabel` |
| 10 | 删除周报 | 支持手动删除某周周报 | `weeklyReport.ts:deleteReport` |
| 11 | 本周检测 | 判断本周是否已有周报 | `weeklyReport.ts:hasCurrentWeekReport` |

#### 数据模型简述

```typescript
WeeklyReport {
  id: string
  weekStart: string       // 周一日期 YYYY-MM-DD
  weekEnd: string         // 周日日期 YYYY-MM-DD
  content: string         // HTML富文本内容
  summary: WeeklyReportSummary
  aiSummary?: string      // AI智能总结文本
  aiSummaryStatus?: 'generating' | 'success' | 'failed'
  createdAt: string
  updatedAt: string
}

WeeklyReportSummary {
  tasksCreated: number
  tasksCompleted: number
  todosCreated: number
  totalXpGained: number
  completionRate: number   // 百分比
  streakDays: number
}
```

---

### 3.6 AI 智能助手

#### 功能描述

内置 OpenAI 兼容 API 对话式智能助手，用户可自定义 API 地址、密钥和模型。助手具备任务上下文感知能力，能自动注入当前任务概况到系统提示词。通过 Function Calling 支持创建任务、查询任务、修改任务、删除任务，修改和删除操作需用户确认后方可执行。

#### 用户故事

- 作为使用者，我需要对话式创建任务，而不必手动填写表单
- 作为管理者，我需要问AI"今天有哪些逾期任务？"并得到即时回答
- 作为安全使用者，我需要AI修改或删除任务前必须得到我的确认
- 作为自定义者，我需要配置自己的AI API地址和密钥

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 对话式交互 | 流式SSE响应，逐字显示 | `ai.ts:send` |
| 2 | API配置 | 自定义apiUrl、apiKey、model | `ai.ts:config` |
| 3 | URL自动补全 | 自动补全/v1/chat/completions路径 | `ai.ts:buildChatUrl` |
| 4 | 任务上下文注入 | 系统提示词自动包含待办/进行中/今日完成/逾期任务概况 | `ai.ts:buildSystemPrompt` |
| 5 | Function Calling | 4个工具：create_task/list_tasks/update_task/delete_task | `ai.ts:TOOLS` |
| 6 | 用户确认机制 | update_task/delete_task需确认，确认卡片展示操作描述 | `ai.ts:CONFIRM_REQUIRED_TOOLS` |
| 7 | 确认/拒绝 | 用户可确认或拒绝AI的待执行操作 | `ai.ts:confirmAction/rejectAction` |
| 8 | 自动执行 | create_task/list_tasks无需确认直接执行 | `ai.ts:executeToolCall` |
| 9 | 额外上下文 | 从任务详情页"AI分析"入口注入特定任务上下文 | `ai.ts:setExtraContext` |
| 10 | 清空对话 | 一键清空所有历史消息 | `ai.ts:clearMessages` |
| 11 | 增量消息持久化 | 单条upsert消息，避免全量保存 | `ai.ts:upsertMessagePersist` |
| 12 | 90秒超时 | 流式请求90秒超时保护 | `ai.ts:send` |
| 13 | 非流式兼容 | 同时支持流式SSE和非流式JSON响应解析 | `ai.ts:send` |

#### 数据模型简述

```typescript
AiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  pendingAction?: AiPendingAction
}

AiPendingAction {
  toolCallId: string
  toolName: string
  args: Record<string, any>
  description: string       // 人可读的操作描述
  confirmed: boolean | null // null=待确认
}

AiConfig {
  apiUrl: string
  apiKey: string
  model: string
}
```

---

### 3.7 主题系统

#### 功能描述

提供四种主题模式：腾讯蓝(tencent)、暗夜(dark)、自动(auto)、紫语(zuru)。浅色模式已隐藏，遗留浅色偏好自动迁移为腾讯蓝。通过 `data-theme` 属性驱动 CSS 变量切换。

#### 用户故事

- 作为使用者，我需要切换到暗夜主题以适应夜间使用
- 作为品牌使用者，我需要使用腾讯蓝主题以获得品牌一致性
- 作为自适应者，我需要主题跟随系统偏好自动切换

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 腾讯蓝主题 | 默认主题，品牌蓝色系 | `useTheme.ts:tencent` |
| 2 | 暗夜主题 | 深色系主题 | `useTheme.ts:dark` |
| 3 | 自动模式 | 跟随系统prefers-color-scheme | `useTheme.ts:auto` |
| 4 | 紫语主题 | 紫色系特殊主题 | `useTheme.ts:zuru` |
| 5 | 主题切换 | 腾讯蓝→暗夜→自动→腾讯蓝循环切换 | `useTheme.ts:toggle` |
| 6 | 持久化 | localStorage存储主题偏好 | `useTheme.ts:STORAGE_KEY` |
| 7 | 遗留迁移 | 浅色偏好自动迁移为腾讯蓝 | `useTheme.ts:light→tencent` |

#### 数据模型简述

```typescript
ThemeMode = 'light' | 'dark' | 'auto' | 'zuru' | 'tencent'
// light 已废弃，自动迁移为 tencent
```

---

### 3.8 用户认证

#### 功能描述

支持手机号 + 密码注册登录，以及验证码注册双模式。密码采用客户端 salt+hash（PBKDF2），密钥明文仅本地校验，服务端只存哈希+盐。支持密码修改和昵称修改。

#### 用户故事

- 作为新用户，我需要通过手机号注册账号并设置密码
- 作为已有用户，我需要通过手机号+密码登录
- 作为安全使用者，我需要密码在本地加密而非明文传输
- 作为个性化者，我需要修改我的昵称

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 手机号登录 | 已注册手机号直接登录 | `auth.ts:checkPhoneAndLogin` |
| 2 | 验证码注册 | 未注册手机号生成验证码，6位数字即可通过(MVP) | `auth.ts:verifyAndRegister` |
| 3 | 密码登录/注册 | 手机号+密码登录，新用户设置密码注册 | `auth.ts:submitPassword` |
| 4 | 遗留账号设密 | 无密码的遗留账号首次设置密码 | `auth.ts:submitPassword(passwordSet)` |
| 5 | 密码校验 | 客户端PBKDF2哈希校验，8位最低长度 | `auth.ts:submitPassword/crypto.ts` |
| 6 | 密码修改 | 验证旧密码后设置新密码 | `auth.ts:changePassword` |
| 7 | 昵称修改 | 修改昵称并同步session | `auth.ts:changeNickname` |
| 8 | 退出登录 | 清除user+session | `auth.ts:logout` |
| 9 | 离线恢复 | 从localStorage session恢复user，消除登录页闪烁 | `auth.ts:init` |

#### 数据模型简述

```typescript
User {
  id: string
  phone: string
  nickname: string
  createdAt: string
  lastLoginAt: string
}

Session {
  userId: string
  phone: string
  nickname: string
  loginAt: number       // Unix timestamp ms
  expiresAt: number     // Unix timestamp ms
}
```

---

### 3.9 数据同步

#### 功能描述

采用 Supabase 作为云端存储，实现增量同步机制。每30秒从云端拉取远端变更，应用到本地 store（仅更新 reactive + localStorage，不回写 Supabase）。同时管理 health check 和 dirty operation replay 生命周期。多用户数据隔离（按userId分区存储）。

#### 用户故事

- 作为多设备使用者，我需要数据在不同设备间自动同步
- 作为离线使用者，我需要离线时数据保存在本地，恢复网络后自动同步
- 作为多账号使用者，我需要不同账号的数据互不干扰

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 增量同步 | 每30秒从Supabase拉取远端变更 | `useSync.ts:runIncrementalSync` |
| 2 | Health Check | 检测Supabase连接状态 | `useSync.ts:startHealthCheck` |
| 3 | 延迟启动 | 首次同步延迟10秒，避免与登录mergeFromCloud冲突 | `useSync.ts:startSyncLoop` |
| 4 | 远端任务应用 | 新增/更新/删除任务应用到本地 | `useSync.ts:applyRemoteTask` |
| 5 | 远端回收站应用 | 新增/更新/删除回收站应用到本地 | `useSync.ts:applyRemoteDeletedTask` |
| 6 | 远端AI消息应用 | 新增/更新/删除AI消息应用到本地 | `useSync.ts:applyRemoteAiMessage` |
| 7 | 墓碑过滤 | 永久删除的任务不通过同步恢复 | `hybrid.ts:getTombstones` |
| 8 | 多用户隔离 | storage按userId分区 | `storage.ts:switchUser` |
| 9 | 本地优先 | 云端不可用时回退到localStorage | `local.ts` |
| 10 | 同步日志 | 记录每次同步的状态和摘要 | `syncLog.ts` |

---

### 3.10 富文本编辑器

#### 功能描述

基于 TipTap 构建的 Markdown+富文本混合编辑器，用于任务描述和备忘内容编辑。支持多种文本格式化扩展。

#### 用户故事

- 作为记录者，我需要在任务描述中使用富文本格式化
- 作为编辑者，我需要在备忘内容中插入列表、引用、代码块等

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | TipTap编辑器 | 基于TipTap核心框架 | `package.json:@tiptap` |
| 2 | 引用块 | blockquote扩展 | `package.json:@tiptap/extension-blockquote` |
| 3 | 无序列表 | bullet-list扩展 | `package.json:@tiptap/extension-bullet-list` |
| 4 | 代码块 | code-block扩展，支持语法高亮 | `package.json:@tiptap/extension-code-block` |
| 5 | 文字颜色 | color扩展 | `package.json:@tiptap/extension-color` |
| 6 | 拖拽光标 | dropcursor扩展 | `package.json:@tiptap/extension-dropcursor` |
| 7 | Markdown导出 | 内容导出为Markdown格式 | `utils/markdownExport.ts` |
| 8 | HTML内容 | 备忘内容以HTML格式存储 | `memo.ts:MemoItem.content` |

---

### 3.11 移动端适配

#### 功能描述

PC端与H5移动端采用自动路由分发：移动设备访问PC路由自动跳转H5，桌面端访问H5路由自动跳转PC首页。H5端提供精简的任务和待办视图，支持强制桌面版偏好。

#### 用户故事

- 作为移动端使用者，我需要精简的H5界面来管理任务
- 作为桌面端使用者，我不希望被误跳转到H5视图
- 作为偏好者，我需要在手机上强制使用桌面版

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 设备检测 | UA关键词 + 屏幕宽度≤480兜底 | `device.ts:isMobileDevice` |
| 2 | 自动路由分发 | 移动端→H5，桌面端→PC | `router.ts:beforeEach` |
| 3 | 强制桌面版 | 用户可设置force_pc阻止自动跳H5 | `device.ts:setForcePC/isForcePC` |
| 4 | H5任务列表 | 精简的任务列表视图 | `router.ts:h5-tasks` |
| 5 | H5任务编辑 | 新建/编辑任务视图 | `router.ts:h5-task-new/h5-task-edit` |
| 6 | H5待办列表 | 精简的待办列表视图 | `router.ts:h5-todos` |
| 7 | H5待办编辑 | 新建/编辑待办视图 | `router.ts:h5-todo-new/h5-todo-edit` |
| 8 | H5设置 | 精简的设置页 | `router.ts:h5-settings` |
| 9 | H5重定向保存 | 登录后跳回原始H5页面 | `router.ts:h5_redirect` |

---

### 3.12 时间线/计时器

#### 功能描述

计时器模块提供工作时段倒计时功能，可自定义工作开始/结束时间和工作日。首页时间线展示带startTime的任务卡片。任务全部完成时触发庆祝动画。

#### 用户故事

- 作为上班族，我需要看到距下班的倒计时
- 作为计划者，我需要在首页时间线上看到今日有时间节点的任务
- 作为使用者，我需要今日任务全部完成时获得庆祝反馈

#### 功能点清单

| # | 功能 | 说明 | 来源 |
|---|------|------|------|
| 1 | 工作时段倒计时 | 可配置工作开始/结束时间和工作日(默认09:00-18:00,周一~周五) | `timer.ts` |
| 2 | 倒计时标签 | 距上班/距下班/已下班/休息日 | `timer.ts:countdownLabel` |
| 3 | 倒计时格式化 | HH:MM:SS格式 | `timer.ts:formatMs` |
| 4 | 时间节点展示 | 任务设置startTime后在首页时间线显示 | `task.ts:startTime` |
| 5 | 全部完成庆祝 | 今日所有任务完成时弹出庆祝卡片（600ms防抖） | `useCompletionCelebration.ts` |
| 6 | 每日唯一庆祝 | 同一天只弹出一次庆祝 | `useCompletionCelebration.ts:hasShownToday` |

#### 数据模型简述

```typescript
TimerConfig {
  workStart: string    // HH:mm 格式，默认 '09:00'
  workEnd: string      // HH:mm 格式，默认 '18:00'
  workDays: number[]   // 工作日编号，默认 [1,2,3,4,5]
}
```

---

## 4. 功能优先级矩阵

| 优先级 | 模块 | 说明 |
|--------|------|------|
| **P0** | 任务管理 | 核心功能，无任务则产品不存在 |
| **P0** | 用户认证 | 入口功能，无认证无法使用 |
| **P0** | 数据同步 | 基础设施，多端数据一致性保障 |
| **P1** | 备忘录 | 重要辅助功能，丰富记录维度 |
| **P1** | 待办事项 | 任务管理的前置缓冲区 |
| **P1** | 养成系统（烛） | 核心差异化，驱动长期使用 |
| **P1** | 周报系统 | 复盘闭环，数据价值最大化 |
| **P1** | 富文本编辑器 | 内容编辑基础设施 |
| **P2** | AI 智能助手 | 增强型功能，依赖外部API |
| **P2** | 主题系统 | 体验层功能，不影响核心流程 |
| **P2** | 移动端适配 | 渠道扩展，PC端已完整可用 |
| **P2** | 时间线/计时器 | 体验增强，锦上添花 |

---

## 5. 非功能性需求

### 5.1 性能指标

| 指标 | 目标 | 实现方式 |
|------|------|----------|
| 首屏加载 | <2秒 | 路由懒加载，store异步初始化 |
| 增量同步延迟 | 30秒轮询 | `useSync.ts:SYNC_INTERVAL=30_000` |
| AI流式首字 | <3秒 | SSE streaming，逐字显示 |
| 回收站自动清除 | 7天 | `task.ts:TRASH_EXPIRE_DAYS=7` |
| 单条持久化 | <100ms | 单记录upsert替代全量保存 |
| 墓碑查询 | O(1) | Set结构存储墓碑ID |

### 5.2 安全要求

| 要求 | 实现方式 |
|------|----------|
| 密码本地加密 | PBKDF2 salt+hash，密钥明文仅客户端校验 |
| 密钥最低强度 | 8位字符 |
| AI操作确认 | update_task/delete_task需用户确认 |
| 数据隔离 | 按userId分区存储，switchUser切换 |
| XSS防护 | HTML转义（escapeHtml）用于周报生成 |
| 墓碑防恢复 | 永久删除任务记录墓碑ID，同步时过滤 |

### 5.3 可用性

| 要求 | 实现方式 |
|------|----------|
| 离线可用 | localStorage作为本地持久层，云端不可用时回退 |
| 设备自适应 | UA检测+屏幕宽度，自动路由分发 |
| 状态恢复 | session localStorage桥接，消除登录页闪烁 |
| 降级优雅 | AI总结失败时静默降级，不影响周报基础内容 |

### 5.4 可维护性

| 要求 | 实现方式 |
|------|----------|
| 状态管理 | Pinia store统一管理，模块化拆分 |
| 类型安全 | TypeScript全量类型定义 |
| 持久化策略 | 单条upsert为主，全量保存仅合并场景 |
| 循环依赖避免 | onTaskDoneCallback注入式解耦（task↔growth） |
| 遗留数据迁移 | sortOrder迁移、主题偏好迁移 |

---

## 6. 版本演进历史

| 版本 | 主要里程碑 |
|------|------------|
| v1.0 | 基础任务管理（CRUD）、备忘录、用户认证（验证码模式） |
| v1.1 | 养成系统（XP/等级/连续/成就）、热力图、回收站机制 |
| v1.2 | AI智能助手（Function Calling）、周报系统、密码登录模式 |
| v1.3.0 | 待办事项模块、AI操作确认机制、H5移动端适配、计时器/时间线、紫语/腾讯蓝主题、增量同步、富文本编辑器、墓碑机制、全部完成庆祝 |

---

> 本文档由 PM 基于源代码反向工程提取，所有功能点均有代码实现对应。文档版本与产品版本同步：v1.3.0。
