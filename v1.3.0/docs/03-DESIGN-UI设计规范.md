# CleanNotes（清记）UI 设计规范 v1.3.0

## 1. 设计系统概述

CleanNotes v1.3.0 采用基于 CSS 自定义属性的设计令牌（Design Tokens）体系，所有视觉属性均通过 `--color-*` 变量集中定义和管理。整套设计体系包含约 **41 个设计令牌**，覆盖色彩、文字、背景、边框、阴影、遮罩、代码高亮等视觉维度。

设计令牌定义在 `src/style.css` 的 `:root` 伪类中，并通过 `[data-theme]` 属性选择器实现多主题切换。主题管理逻辑位于 `src/composables/useTheme.ts`，通过 `document.documentElement.setAttribute('data-theme', theme)` 动态切换主题。

### 1.1 主题模式

| 主题模式 | `data-theme` 值 | 说明 |
|---------|---------------|------|
| **腾讯蓝（tencent）** | `tencent` | **默认主题**。基于 TDesign 品牌色 #0052D9，所有语义色（success 等）重定向为品牌蓝 |
| **暗黑模式（dark）** | `dark` | 暗色背景体系，降低对比度，减少视觉疲劳 |
| **ZURU 品牌色（zuru）** | `zuru` | 基于 ZURU 品牌红 #CB312D，白灰背景体系 |
| **自动（auto）** | `light` / `dark` | 跟随系统 `prefers-color-scheme` 媒体查询自动切换（浅色已废弃，自动迁移为 tencent） |

> **注意**：`:root` 中的默认值对应传统"浅色"主题。`light` 模式在初始化时自动迁移为 `tencent`（浅色主题已隐藏）。`auto` 模式下根据系统偏好选择 `dark` 或回退到默认浅色值。

### 1.2 变量命名规范

采用 `--color-{语义类别}-{变体}` 的命名模式：

- **语义类别**：`primary`（主色）、`success`（成功）、`warning`（警告）、`danger`（危险）、`info`（信息）、`accent`（强调）
- **语义变体**：`-light`（浅底色）、`-lighter`（更浅底色）、`-text`（前景文字色）、`-hover`（悬停态）、`-disabled`（禁用态）
- **文本层级**：`text-1`（主要）、`text-2`（次要）、`text-3`（辅助）、`text-4`（占位/禁用）
- **背景层级**：`bg-1`（页面底色）→ `bg-2` → `bg-3` → `bg-4`（最重底色）
- **其他**：`surface`（卡片/弹窗底色）、`border`/`border-light`（边框）

---

## 2. 色彩系统

### 2.1 腾讯蓝主题（tencent）— 默认主题

腾讯蓝主题基于 TDesign 设计体系的品牌色 `#0052D9`，其核心设计理念是将 **所有功能色（success、info 等）统一映射为品牌蓝**，只保留 warning 和 danger 的独立语义色，形成蓝灰为主、橙红点缀的视觉韵律。

#### 2.1.1 主色色板

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-primary` | `#0052D9` | 主色（TDesign 品牌蓝） |
| `--color-primary-light` | `#EDF1FF` | 主色浅底色 |
| `--color-primary-hover` | `#003CAB` | 主色悬停态（深 2 档） |
| `--color-primary-disabled` | `#8EABFF` | 主色禁用态 |

#### 2.1.2 语义功能色

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-success` | `#0052D9` | 成功色（重定向为品牌蓝） |
| `--color-success-light` | `#EDF1FF` | 成功浅底色 |
| `--color-success-lighter` | `#F2F3FF` | 成功更浅底色 |
| `--color-success-text` | `#003CAB` | 成功文字色（深蓝） |
| `--color-warning` | `#E37318` | 警告色（TDesign 橙） |
| `--color-warning-light` | `#FFF4E8` | 警告浅底色 |
| `--color-warning-text` | `#BE5A00` | 警告文字色 |
| `--color-danger` | `#D54941` | 危险色（TDesign 红） |
| `--color-danger-light` | `#FFECEB` | 危险浅底色 |
| `--color-danger-text` | `#AD352F` | 危险文字色 |
| `--color-info` | `#0052D9` | 信息色（重定向为品牌蓝） |
| `--color-info-light` | `#EDF1FF` | 信息浅底色 |
| `--color-info-lighter` | `#F2F3FF` | 信息更浅底色 |
| `--color-info-text` | `#003CAB` | 信息文字色 |
| `--color-accent` | `#7C3AED` | 强调色（紫色，保留独立） |
| `--color-accent-light` | `#F5F0FF` | 强调浅底色 |
| `--color-accent-text` | `#5B21B6` | 强调文字色 |

#### 2.1.3 中性色

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-text-1` | `#0F172A` | 主要文字（深蓝灰） |
| `--color-text-2` | `#475569` | 次要文字 |
| `--color-text-3` | `#64748B` | 辅助文字 |
| `--color-text-4` | `#9CA3AF` | 占位符/禁用文字 |
| `--color-bg-1` | `#F3F3F4` | 页面底色（TDesign BlueGray） |
| `--color-bg-2` | `#EEEEF0` | 次级背景 |
| `--color-bg-3` | `#E7E8EB` | 第三级背景 |
| `--color-bg-4` | `#DCDDE1` | 最重底色（hover 态等） |
| `--color-surface` | `#FFFFFF` | 卡片/弹窗/表面色（白色） |
| `--color-border` | `#D5D6DA` | 边框色 |
| `--color-border-light` | `#E0E1E5` | 浅边框色 |
| `--color-white` | `#FFFFFF` | 纯白 |

#### 2.1.4 特效色

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-focus-ring` | `rgba(0, 82, 217, 0.10)` | 聚焦环（品牌蓝 10% 透明） |
| `--color-shadow` | `rgba(0, 0, 0, 0.04)` | 基础阴影 |
| `--color-shadow-md` | `rgba(0, 0, 0, 0.10)` | 中等阴影 |
| `--color-overlay` | `rgba(0, 0, 0, 0.25)` | 遮罩层 |
| `--color-overlay-md` | `rgba(0, 0, 0, 0.35)` | 加深深罩层 |

#### 2.1.5 代码色

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-code-bg` | `#F3F3F4` | 内联代码背景 |
| `--color-code-text` | `#0F172A` | 内联代码文字 |
| `--color-pre-bg` | `#1E293B` | 代码块背景（深色） |
| `--color-pre-text` | `#E2E8F0` | 代码块文字（浅色） |

### 2.2 暗黑模式（dark）

#### 2.2.1 主色与功能色

| 变量名 | 色值 | 与浅色主题对比 |
|-------|------|-------------|
| `--color-primary` | `#6b81f8` | 提亮 ~0.3 倍 |
| `--color-primary-light` | `#1c1f3d` | 深紫蓝底 |
| `--color-primary-hover` | `#5a73f0` | 更深的悬停蓝 |
| `--color-primary-disabled` | `#3a4060` | 灰蓝禁用 |
| `--color-success` | `#4d8fff` | 冷蓝绿调 |
| `--color-success-text` | `#6aabff` | 提亮文字 |
| `--color-warning` | `#fbbf24` | 暖黄 |
| `--color-warning-text` | `#fbbf24` | 相同暖黄 |
| `--color-danger` | `#f87171` | 柔和红 |
| `--color-danger-text` | `#fca5a5` | 浅红文字 |
| `--color-info` | `#60a5fa` | 天蓝 |
| `--color-info-text` | `#93bbfd` | 浅蓝文字 |
| `--color-accent` | `#a78bfa` | 亮紫 |
| `--color-accent-text` | `#c4b5fd` | 浅紫文字 |

#### 2.2.2 中性色

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-text-1` | `#f1f5f9` | 主要文字（近白） |
| `--color-text-2` | `#cbd5e1` | 次要文字 |
| `--color-text-3` | `#94a3b8` | 辅助文字 |
| `--color-text-4` | `#64748b` | 占位/禁用（反色对应 text-3） |
| `--color-bg-1` | `#0f1115` | 页面底色（极深灰黑） |
| `--color-bg-2` | `#1a1b20` | 次级背景 |
| `--color-bg-3` | `#1e2028` | 第三级背景 |
| `--color-bg-4` | `#252730` | 最重底色（hover 态，微亮） |
| `--color-surface` | `#1a1b20` | 卡片/弹窗（与 bg-2 同色） |
| `--color-border` | `#2e3038` | 暗色边框 |
| `--color-border-light` | `#252730` | 暗色浅边框（与 bg-4 同色） |

#### 2.2.3 特效与代码色

| 变量名 | 色值 |
|-------|------|
| `--color-focus-ring` | `rgba(107, 129, 248, 0.15)` |
| `--color-shadow` | `rgba(0, 0, 0, 0.25)` |
| `--color-shadow-md` | `rgba(0, 0, 0, 0.4)` |
| `--color-overlay` | `rgba(0, 0, 0, 0.55)` |
| `--color-overlay-md` | `rgba(0, 0, 0, 0.65)` |
| `--color-code-bg` | `#252730` |
| `--color-code-text` | `#cbd5e1` |
| `--color-pre-bg` | `#111318` |
| `--color-pre-text` | `#e2e8f0` |

**暗黑模式映射规则**：
- 文字色 "反转"：浅色系的 text-1→text-4 在暗色系中最亮为 text-1，最暗为 text-4
- 背景色深色化：层级保持但整体降至深色区间（#0f1115 ~ #252730）
- 功能色整体提亮 0.2~0.3 倍以在深背景上保持可辨识
- 阴影变重：从 0.04 → 0.25，使用纯黑阴影
- 代码块背景：pre-bg 从深灰色变为更深色（#111318）

### 2.3 ZURU 品牌色（zuru）

基于 ZURU 品牌标准色 `#CB312D`（品牌红）。ZURU 主题的核心设计理念是 **"统一红色色系 + 白灰中性体系"** —— 所有功能色统一映射为品牌红，仅 info 保持灰色作为次要色。

#### 2.3.1 品牌红色系

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-primary` | `#CB312D` | 品牌红（主色） |
| `--color-primary-light` | `#F9EBEB` | 浅红底色 |
| `--color-primary-hover` | `#AD2A26` | 悬停深红 |
| `--color-primary-disabled` | `#E59895` | 禁用浅红 |
| `--color-success` | `#CB312D` | 成功色 = 品牌红 |
| `--color-success-text` | `#AD2A26` | 成功文字 = 深红 |
| `--color-warning` | `#CB312D` | 警告色 = 品牌红 |
| `--color-warning-text` | `#AD2A26` | 警告文字 = 深红 |
| `--color-danger` | `#CB312D` | 危险色 = 品牌红 |
| `--color-danger-text` | `#AD2A26` | 危险文字 = 深红 |
| `--color-accent` | `#CB312D` | 强调色 = 品牌红 |

#### 2.3.2 灰色系（info / 次要功能）

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-info` | `#999999` | 信息色（灰色，唯一独立色） |
| `--color-info-light` | `#F5F5F5` | 信息浅灰底 |
| `--color-info-lighter` | `#FAFAFA` | 信息更浅底 |
| `--color-info-text` | `#666666` | 信息文字灰 |

#### 2.3.3 中性色

| 变量名 | 色值 | 说明 |
|-------|------|------|
| `--color-text-1` | `#1A1A1A` | 主要文字（ZURU 深黑） |
| `--color-text-2` | `#666666` | 次要文字 |
| `--color-text-3` | `#999999` | 辅助文字 |
| `--color-text-4` | `#BFBFBF` | 占位/禁用 |
| `--color-bg-1` | `#F1F3F6` | 页面底色 |
| `--color-bg-2` | `#F5F6F8` | 次级背景 |
| `--color-bg-3` | `#F8F9FB` | 第三级背景 |
| `--color-bg-4` | `#EBEDF0` | 最重底色（注意：比 bg-1 更深） |
| `--color-surface` | `#FFFFFF` | 卡片/弹窗白色 |
| `--color-border` | `#DFE2E6` | 边框色 |
| `--color-border-light` | `#E8EBEF` | 浅边框 |
| `--color-white` | `#FFFFFF` | 纯白 |

#### 2.3.4 特效与代码色

| 变量名 | 色值 |
|-------|------|
| `--color-focus-ring` | `rgba(203, 49, 45, 0.12)` |
| `--color-shadow` | `rgba(0, 0, 0, 0.04)` |
| `--color-shadow-md` | `rgba(0, 0, 0, 0.08)` |
| `--color-overlay` | `rgba(0, 0, 0, 0.25)` |
| `--color-overlay-md` | `rgba(0, 0, 0, 0.35)` |
| `--color-code-bg` | `#F1F3F6` |
| `--color-code-text` | `#1A1A1A` |
| `--color-pre-bg` | `#F8F9FB` |
| `--color-pre-text` | `#1A1A1A` |

**ZURU 主题特点**：
- 所有功能色统一为品牌红，保证品牌一致性
- info 色保持灰色（#999999），用于"低优先"等次要标签
- background 层级采用白灰渐变体系（#F1F3F6 → #FFFFFF）
- bg-4（#EBEDF0）比 bg-1 更深，用于 hover 态反衬
- 代码块保持浅色背景（F8F9FB），与浅色模式一致

### 2.4 通用浅色主题（:root / 未标记 data-theme 或 light）

这是最初的"默认浅色"主题，使用独立的功能色体系（绿/橙/红/蓝），目前由 `auto` 模式在系统为浅色时回退使用。

#### 2.4.1 功能色

| 变量名 | 色值 |
|-------|------|
| `--color-primary` | `#4f6cf7` |
| `--color-primary-light` | `#eef2ff` |
| `--color-primary-hover` | `#3b5de7` |
| `--color-primary-disabled` | `#b4c4f9` |
| `--color-success` | `#22c55e` |
| `--color-success-text` | `#16a34a` |
| `--color-warning` | `#f59e0b` |
| `--color-warning-text` | `#d97706` |
| `--color-danger` | `#ef4444` |
| `--color-danger-text` | `#dc2626` |
| `--color-info` | `#3b82f6` |
| `--color-info-text` | `#2563eb` |
| `--color-accent` | `#7c3aed` |
| `--color-accent-text` | `#5b21b6` |

#### 2.4.2 中性色

| 变量名 | 色值 |
|-------|------|
| `--color-text-1` | `#0f172a` |
| `--color-text-2` | `#475569` |
| `--color-text-3` | `#64748b` |
| `--color-text-4` | `#9ca3af` |
| `--color-bg-1` | `#f8f9fc` |
| `--color-bg-2` | `#f1f5f9` |
| `--color-bg-3` | `#f9fafb` |
| `--color-bg-4` | `#f3f4f6` |
| `--color-surface` | `#ffffff` |
| `--color-border` | `#e2e8f0` |
| `--color-border-light` | `#ebeef5` |

### 2.5 半透明效果规范

登录页使用 `color-mix()` 函数实现玻璃态半透明效果，替代传统 `rgba()`：

```css
/* 登录卡片背景：78% 表面色 + 22% 透明 */
background: color-mix(in srgb, var(--color-surface) 78%, transparent);

/* 输入框背景：60% 表面色 + 40% 透明 */
background: color-mix(in srgb, var(--color-surface) 60%, transparent);

/* 背景装饰 orb：品牌色 12% 透明度 */
background: radial-gradient(circle, color-mix(in srgb, var(--color-success) 12%, transparent) 0%, transparent 70%);

/* 按钮 disabled 态：品牌色 35% + 边框色混合 */
background: color-mix(in srgb, var(--color-success) 35%, var(--color-border));

/* 焦点环：品牌色 12% 透明度 */
box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 12%, transparent);
```

---

## 3. 字体与排版

### 3.1 字体栈

**系统字体栈**（全局默认，定义在 `style.css`）：

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
             "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

**等宽字体栈**（代码相关）：

```css
font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
```

**字体平滑**：全局启用 `-webkit-font-smoothing: antialiased`。

### 3.2 字号层级

以下数据提取自各组件的实际 `font-size` 属性值：

| 层级 | 字号 | 使用场景 |
|------|------|---------|
| **特大字** | `40px` | 登录页时钟数字（font-weight: 700, 等宽字体, letter-spacing: 2px） |
| **特大标题** | `30px` | 登录页品牌标题"清记"（font-weight: 700） |
| **大标题** | `22px` | 登录卡标题"欢迎回来"（font-weight: 700）、README h1（font-weight: 700） |
| **中标题** | `20px` | 养成部件等级 "Lv.X"（font-weight: 700, letter-spacing: -0.02em）、Markdown 预览 h1（font-weight: 700） |
| **小标题** | `18px` | XP Toast 数值 "+X XP"（font-weight: 700, letter-spacing: -0.02em） |
| | `17px` | Markdown 预览 h2（font-weight: 600） |
| | `16px` | 弹窗标题、README h2、README 模态标题（font-weight: 600） |
| **正文（大）** | `15px` | 侧栏品牌标题（font-weight: 700）、编辑弹窗标题输入（font-weight: 500）、登录按钮（font-weight: 600）、Markdown 预览 h3、登录页副标题、全屏编辑 textarea |
| **正文（标准）** | `14px` | 弹窗输入框、Markdown 预览正文、登录页功能列表项、登录卡副标题、时钟日期、用户头像文字 |
| **正文（小）** | `13px` | 导航项（font-weight: 500）、任务标题、编辑区 textarea、状态选择框、删除按钮、取消按钮、保存按钮、表单错误信息、侧栏用户名（font-weight: 600）、READEME 正文 |
| **辅助文字（大）** | `12px` | 优先级按钮、优先级标签、养成状态标签、XP/经验值文字、连续天数徽章、表单脚注、内联代码字号、全屏编辑 textarea（仅字号，行高不同） |
| **辅助文字（小）** | `11px` | 表单标签（font-weight: 500, letter-spacing: 0.3px）、标签页切换、截止日期、Markdown 提示、XP 来源标签、状态锁定提示、侧栏用户手机号、同步状态文字 |
| **微小文字** | `10px` | 徽章（新建/编辑/复制）、Markdown 提示、版本信息行 |
| | `9px` | README 入口链接 |

### 3.3 字重规范

| 字重 | CSS | 使用场景 |
|------|-----|---------|
| 700（Bold） | `font-weight: 700` | 时钟数字、品牌标题、等级显示、XP Toast 数值、侧栏品牌名 |
| 600（SemiBold） | `font-weight: 600` | 弹窗标题、侧栏用户名、连续天数徽章、登录按钮、h2/h3 标题、strong |
| 500（Medium） | `font-weight: 500` | 导航项、编辑标题输入、优先级/状态标签、表单标签 |
| 400（Regular） | `font-weight: 400`（默认） | 正文、描述文字、Markdown 提示 |

### 3.4 行高规范

| 行高 | 使用场景 |
|------|---------|
| `1.0` | 导航标签（`.nav-label`） |
| `1.2` | 侧栏品牌标题、用户信息 |
| `1.4` | 养成消息、登录副标题 |
| `1.6` | 代码块（pre） |
| `1.7` | README 正文、编辑区 textarea |
| `1.75` | Markdown 预览区 |
| `1.8` | 全屏编辑 textarea |

### 3.5 字间距

| 间距值 | 使用场景 |
|-------|---------|
| `-0.02em` | 等级数字 "Lv.X"、XP Toast "+X XP"（紧凑显示） |
| `0.3px` | 表单标签（`.field-label`，增加可读性） |
| `2px` | 登录页时钟数字（增强数字节奏感） |

---

## 4. 间距与圆角

### 4.1 间距阶梯

提取自各组件中 `gap`、`padding`、`margin` 的实际值，按升序排列：

| 间距 | 使用场景 |
|------|---------|
| `1px` | 侧栏品牌文字子项间距 |
| `2px` | 任务列表项间距（gap）、标签切换器间距、时钟日期间距、版本信息行 |
| `3px` | - |
| `4px` | 侧栏导航项间距（gap）、退出按钮 padding、Markdown 标签标记间距、禁用的主页按钮 padding、XP 来源标签间距、全屏标记 |
| `5px` | 表单组间距（gap）、优先级按钮间距（gap） |
| `6px` | - |
| `7px` | - |
| `8px` | 同步状态行间距（gap）、弹窗标题行间距（gap）、页脚按钮间距、养成头部间距、Markdown 预览 h2 下边距、侧栏模态关闭部件间距 |
| `10px` | 侧栏品牌图标间距、导航项间距、用户卡片间距、任务列表项间距（gap）、XP Toast 间距、功能列表项间距、Markdown 预览 p 下边距 |
| `12px` | 侧栏导航项 padding（横向）、用户卡片 padding、Markdown 预览 h2 上边距、养成底部间距、表单错误信息间距 |
| `14px` | 弹窗 body 表单项间距（gap）、Markdown 预览 hr 间距 |
| `16px` | 侧栏底部 padding（纵向）、品牌区底部间距、登录表单间距、Markdown 预览 h3 上边距、h1 下边距、hr 间距 |
| `18px` | - |
| `20px` | 侧栏整体 padding（纵向）、养成部件间距（gap）、用户卡片底部间距 |
| `24px` | 养成部件 padding、README 模态 body padding、h2 上边距 |
| `28px` | README 模态 body padding(全屏)、登录卡内边距、登录副标题下边距 |
| `32px` | 时钟部件底部间距 |
| `36px` | - |
| `40px` | - |
| `44px` | 登录卡上内边距 |
| `60px` | 登录页左右面板 padding |

### 4.2 圆角规范

| 圆角值 | 使用场景 |
|--------|---------|
| `3px` | 滚动条滑块、蜡烛底座 |
| `4px` | 同步时间标签、选项卡按钮、工具栏按钮、进度条、内联代码、READEME code |
| `6px` | 退出按钮、优先级按钮、优先级/状态标签、状态选择框、选项卡切换容器、XP 来源标签、Markdown 预览图片、blockquote 右侧 |
| `8px` | 任务项、弹窗关闭按钮、输入框、textarea、取消按钮、删除按钮、保存按钮、密码显示切换按钮、代码块 pre、Markdown 预览 pre、README pre、README 关闭按钮 |
| `10px` | 侧栏品牌图标、导航项、状态标签、表单错误信息、弹窗模态关闭按钮 |
| `12px` | 用户卡片、README 模态、登录输入框（field-input）、登录提交按钮 |
| `14px` | 任务编辑弹窗（.modal-dialog）、XP Toast 卡片 |
| `16px` | 品牌图标容器、养成部件 |
| `20px` | 登录表单卡片（form-card） |
| **圆形** | `50%` | 用户头像、任务核对按钮、状态指示灯、优先级圆点 |

---

## 5. 组件视觉规范

### 5.1 按钮

#### 5.1.1 主按钮（btn-save）

用于主要操作（创建、保存）。

```css
.btn-save {
  padding: 7px 22px;
  border: none;
  border-radius: 8px;
  color: var(--color-surface);
  background: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-save:hover { opacity: 0.85; }
```

| 状态 | 样式 |
|------|------|
| **默认** | `background: var(--color-primary)`, `color: var(--color-surface)` |
| **悬停** | `opacity: 0.85` |
| **过渡** | `opacity 0.15s` |

#### 5.1.2 次要按钮（btn-cancel）

用于取消操作。

```css
.btn-cancel {
  padding: 7px 18px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-3);
  font-size: 13px;
}
.btn-cancel:hover {
  background: var(--color-bg-3);
  color: var(--color-text-2);
}
```

#### 5.1.3 危险按钮（btn-delete）

用于删除等破坏性操作。

```css
.btn-delete {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  border: 1px solid var(--color-danger);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-danger);
  font-size: 13px;
}
.btn-delete:hover {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
}
```

#### 5.1.4 导航按钮（nav-item）

侧栏导航条目。

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  color: var(--color-text-2);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}
.nav-item:hover { background: var(--color-bg-4); }
.nav-item.active { background: var(--color-success-light); color: var(--color-success-text); }
```

#### 5.1.5 文本框按钮（tb-btn）

Markdown 工具栏按钮。

```css
.tb-btn {
  width: 28px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  border-radius: 4px;
  transition: all 0.12s;
}
.tb-btn:hover { background: var(--color-bg-4); color: var(--color-text-1); }
.tb-btn:active { background: var(--color-primary); color: var(--color-surface); }
```

#### 5.1.6 选项卡按钮（tab-btn）

编辑/预览切换按钮。

```css
.tab-btn {
  padding: 3px 12px;
  border: none;
  background: transparent;
  font-size: 11px;
  color: var(--color-text-3);
  border-radius: 4px;
  transition: all 0.12s;
}
.tab-btn.active {
  background: var(--color-surface);
  color: var(--color-text-2);
  box-shadow: 0 1px 2px var(--color-shadow);
}
```

#### 5.1.7 优先级按钮（pri-btn）

```css
.pri-btn {
  padding: 5px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-surface);
  color: var(--color-text-3);
  transition: all 0.12s;
}
.pri-btn:hover { border-color: var(--color-text-4); }
```

#### 5.1.8 登录提交按钮（btn-submit）

```css
.btn-submit {
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: var(--color-success);
  color: var(--color-white);
  font-size: 15px;
  font-weight: 600;
  margin-top: 4px;
  transition: background 0.2s, transform 0.1s;
}
.btn-submit:hover:not(:disabled) { background: var(--color-success-text); }
.btn-submit:active:not(:disabled) { transform: scale(0.98); }
.btn-submit:disabled { background: color-mix(in srgb, var(--color-success) 35%, var(--color-border)); cursor: not-allowed; }
```

### 5.2 输入框

#### 5.2.1 标准输入框（field-input）

```css
.field-input {
  padding: 8px 12px;
  border: 1px solid var(--color-border-light);
  border-left: 3px solid var(--color-border);  /* 左侧强调色条 */
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-1);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: var(--color-surface);
}
.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
.field-input:disabled {
  background: var(--color-bg-3);
  color: var(--color-text-2);
  cursor: default;
}
```

**标题输入框特殊样式**：
```css
.title-input {
  font-size: 15px;
  font-weight: 500;
  /* 左侧强调色条颜色由优先级动态控制（borderLeftColor） */
}
```

#### 5.2.2 登录页输入框

```css
.login-page .field-input {
  padding: 13px 16px 13px 42px;  /* 左侧留出图标空间 */
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-surface) 60%, transparent); /* 半透明 */
}
.login-page .field-input::placeholder { color: var(--color-text-4); }
.login-page .field-input:focus {
  border-color: var(--color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 12%, transparent);
}
```

#### 5.2.3 Textarea（field-textarea / md-editor）

```css
.field-textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 0 0 8px 8px;  /* 顶部与工具栏无缝衔接，仅底部圆角 */
  font-size: 13px;
  line-height: 1.7;
  min-height: 120px;  /* 非全屏最小高度 */
  resize: none;
  color: var(--color-text-1);
  background: var(--color-surface);
  transition: border-color 0.15s;
}
/* 编辑弹窗中 flex 弹性高度 */
.desc-group .field-textarea {
  flex: 1;
  min-height: 220px;
}
.field-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```

#### 5.2.4 下拉选择框（field-select）

```css
.field-select {
  padding: 5px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-1);
  background: var(--color-surface);
  height: 30px;
  cursor: pointer;
}
```

### 5.3 卡片

#### 5.3.1 养成部件卡片（spirit-widget）

```css
.spirit-widget {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--color-surface);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px var(--color-shadow);
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.spirit-widget:hover {
  box-shadow: 0 3px 12px var(--color-shadow-md);
  transform: translateY(-1px);  /* 微上浮 */
}
```

#### 5.3.2 登录表单卡片

```css
.form-card {
  width: 420px;
  background: color-mix(in srgb, var(--color-surface) 78%, transparent);
  backdrop-filter: blur(16px);           /* 毛玻璃效果 */
  -webkit-backdrop-filter: blur(16px);
  border-radius: 20px;
  padding: 44px 40px;
  box-shadow: 0 4px 30px var(--color-shadow), 0 1px 3px var(--color-shadow-md);
  border: 1px solid var(--color-border-light);
}
```

### 5.4 弹窗/对话框

#### 5.4.1 任务编辑弹窗（modal-dialog）

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}
.modal-dialog {
  width: 600px;
  max-width: 92vw;
  max-height: 88vh;
  background: var(--color-surface);
  border-radius: 14px;
  box-shadow: 0 16px 48px var(--color-shadow-md);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.modal-header {
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--color-border);
}
.modal-body {
  padding: 18px 22px;
  gap: 14px;
  overflow-y: auto;
}
.modal-footer {
  padding: 14px 22px;
  border-top: 1px solid var(--color-border-light);
}
```

#### 5.4.2 README 模态

```css
.readme-modal {
  width: 720px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
}
.readme-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
}
.readme-body {
  padding: 24px 28px;
  font-size: 14px;
  line-height: 1.7;
}
/* 全屏模式 */
.readme-modal.fullscreen {
  width: 100vw;
  max-width: 100vw;
  max-height: 100vh;
  height: 100vh;
  border-radius: 0;
  box-shadow: none;
}
```

#### 5.4.3 弹窗动画

```css
/* 淡入 - 用于遮罩 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
  animation-duration: 0.15s;
}

/* 缩放进入 - 用于模态框 */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
  animation-duration: 0.15s;
}
```

### 5.5 标签/徽章

#### 5.5.1 操作徽章（新建/编辑/复制）

```css
.new-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-info-light);
  color: var(--color-info);
  border-radius: 10px;
}
.edit-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-warning-light);
  color: var(--color-warning-text);
  border-radius: 10px;
}
.copy-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  background: var(--color-success-lighter);
  color: var(--color-success-text);
  border-radius: 10px;
}
```

#### 5.5.2 养成状态标签

```css
.spirit-widget__state {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-bg-3);
  /* 文字颜色由状态动态决定: vitality=success-text, recovery=warning-text, withered=text-3 */
}
```

#### 5.5.3 连续天数徽章

```css
.spirit-widget__streak-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-warning-text);
  background: var(--color-warning-light);
  padding: 3px 10px;
  border-radius: 12px;
}
```

#### 5.5.4 优先级/状态标签（pri-tag）

```css
.pri-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 12px;
  border-radius: 6px;
  /* 背景和文字颜色由数据动态决定 */
}
```

### 5.6 Toast 通知

#### 5.6.1 XP Toast

```css
.xp-toast {
  position: fixed;
  top: 80px;
  right: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 12px 18px;
  box-shadow: 0 4px 16px var(--color-shadow-md);
  z-index: 1000;
  border: 1px solid var(--color-warning-light);
}
.xp-toast__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-warning-text);
  letter-spacing: -0.02em;
}
.xp-toast__source-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--color-bg-3);
  color: var(--src-color);  /* 由 source 类型动态决定 */
}
```

**Toast 进出场动画**：

```css
/* 进入 - 弹性动画 */
.xp-toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);  /* 回弹缓动 */
}
.xp-toast-enter-from {
  opacity: 0;
  transform: translateY(-24px) scale(0.9);
}

/* 离开 - 平滑淡出 */
.xp-toast-leave-active {
  transition: all 0.25s ease;
}
.xp-toast-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}
```

### 5.7 进度条

```css
.spirit-widget__bar {
  flex: 1;
  height: 8px;
  background: var(--color-bg-4);
  border-radius: 4px;
  overflow: hidden;
}
.spirit-widget__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-warning), var(--color-primary));
  border-radius: 4px;
  transition: width 0.6s ease;
}
/* 进度条内部光泽（伪元素） */
.spirit-widget__fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.25), transparent);
  border-radius: 4px 4px 0 0;
}
```

| 属性 | 值 |
|------|---|
| 高度 | `8px` |
| 圆角 | `4px` |
| 背景轨道 | `var(--color-bg-4)` |
| 进度填充 | `linear-gradient(90deg, var(--color-warning), var(--color-primary))` |
| 过渡 | `width 0.6s ease` |
| 光泽效果 | `::after` 伪元素，上半白色 25% 透明 |

### 5.8 确认对话框

确认对话框（`ConfirmDialog.vue`）支持三种类型：

| 类型 | 图标颜色 | 使用场景 |
|------|---------|---------|
| `warning` | 警告色 | 退出登录、重新激活任务 |
| `danger` | 危险色 | 删除任务确认 |

**样式要点**：
- 遮罩层 z-index: `11000`（高于弹窗的 1000）
- 对话框最大宽度 `400px`
- 圆角 `14px`（与编辑弹窗一致）
- 按钮风格与编辑弹窗页脚保持一致

### 5.9 全屏编辑器（Markdown Fullscreen）

当用户在任务编辑弹窗中点击全屏编辑按钮，textarea 切换为固定定位全屏模式：

```css
.md-editor-container.md-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--color-bg-1);
}
.md-editor-container.md-fullscreen .field-textarea {
  flex: 1;
  min-height: 0;
  border-radius: 0;
  border: none;
  font-size: 15px;
  line-height: 1.8;
  padding: 24px 48px;
  resize: none;
  width: 100%;
  background: var(--color-bg-1);
}
.md-editor-container.md-fullscreen .md-toolbar {
  border-radius: 0;
  padding: 6px 12px;
  background: var(--color-bg-2);
  box-shadow: 0 1px 3px var(--color-shadow);
}
```

### 5.10 Markdown 预览渲染

```css
.md-preview {
  padding: 14px 16px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  min-height: 100px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--color-text-2);
  background: var(--color-surface);
  font-family: -apple-system, ...; /* 继承全局字体栈 */
}
.md-preview h1 { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border-light); padding-bottom: 6px; }
.md-preview h2 { font-size: 17px; font-weight: 600; margin: 12px 0 8px; }
.md-preview h3 { font-size: 15px; font-weight: 600; margin: 10px 0 6px; }
.md-preview code { background: var(--color-code-bg); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--color-code-text); font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace; }
.md-preview pre { background: var(--color-pre-bg); color: var(--color-pre-text); padding: 14px; border-radius: 8px; overflow-x: auto; line-height: 1.6; }
.md-preview blockquote { border-left: 3px solid var(--color-primary); padding: 4px 0 4px 14px; color: var(--color-text-3); background: var(--color-bg-3); border-radius: 0 6px 6px 0; }
.md-preview a { color: var(--color-primary); text-decoration: none; border-bottom: 1px solid var(--color-primary); }
.md-preview table th { background: var(--color-bg-3); font-weight: 600; }
.md-preview strong { font-weight: 600; color: var(--color-text-1); }
.md-preview li::marker { color: var(--color-text-4); }
```

---

## 6. 图标体系

### 6.1 SVG 内联图标

CleanNotes 使用 **Feather Icons** 风格的内联 SVG 图标（`stroke="currentColor"` 继承父元素颜色）。

**通用属性**：
```xml
width="18" height="18"
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
stroke-width="2"
stroke-linecap="round"
stroke-linejoin="round"
```

**尺寸规范**：

| 尺寸 | 使用场景 |
|------|---------|
| `20x20` | 侧栏品牌图标 |
| `18x18` | 导航项图标、登录页输入框图标、登录页功能列表图标、密码显示/隐藏图标 |
| `16x16` | 退出登录按钮、弹窗关闭按钮、全屏按钮 |
| `14x14` | 任务核对按钮（SVG）、删除按钮、Markdown 工具栏按钮 |
| `12x12` | 连续天数火焰图标 |
| `32x32` | 登录页品牌图标容器 |

### 6.2 暗黑模式适配

SVG 图标通过 `stroke="currentColor"` 继承父元素的 `color` 属性，因此自动跟随主题文字色变化，无需为暗黑模式额外定义。

---

## 7. 养成系统视觉规范

### 7.1 角色概述

养成系统的核心视觉元素是一只名为「烛」的蜡烛角色。蜡烛形态通过 **三个维度** 映射成长状态：
- **火焰高度** → 等级（Lv.1~50: 14px→30px 线性插值）
- **光晕半径** → 日活力状态（vitality: 30px / recovery: 22px / withered: 14px）
- **蜡烛体高度** → 累计经验（Lv.1~50: 28px→52px 线性插值）

### 7.2 SVG 渐变体系

蜡烛 SVG 共定义了 **8 个渐变**（位于 `<defs>` 中）：

#### 7.2.1 光晕渐变（radialGradient）

```svg
<radialGradient id="haloGrad" gradientUnits="userSpaceOnUse">
  <!-- 活力: 0%/18%·70%/8%·100%/0% -->
  <!-- 复苏: 0%/18%·70%/8%·100%/0% -->
  <!-- 倦意: 0%/12%·70%/4%·100%/0% -->
</radialGradient>
```

| 状态 | 0% stop-opacity | 70% stop-opacity | 100% stop-opacity |
|------|----------------|-----------------|-------------------|
| 活力 | 0.18 | 0.08 | 0 |
| 复苏 | 0.18 | 0.08 | 0 |
| 倦意 | 0.12 | 0.04 | 0 |

#### 7.2.2 火焰三层渐变（linearGradient）

**外层火焰（flameOuterGrad）**：`#FFD080` → `#F0A830`（下到上）
**中层火焰（flameMiddleGrad）**：`#FFB850` → `#E88A10`（下到上）
**内层亮心（flameInnerGrad）**：`#FFFCE8` → `#FFF0D0`（下到上）

#### 7.2.3 蜡烛体渐变

**蜡烛体（candleBodyGrad）**：
| 模式 | 顶部颜色 | 底部颜色 |
|------|---------|---------|
| 浅色 | `#FAF0DC` | `#F0E0C0` |
| 暗黑 | `#E8DCC8` | `#D4C4A0` |

**融化弧（meltGrad）**：上部为填充色 → 下部为蜡烛体顶色
| 模式 | 起始色 | 结束色 |
|------|-------|-------|
| 浅色 | `#FFF8E8` | `#FAF0DC` |
| 暗黑 | `#F0E0C8` | `#E8DCC8` |

#### 7.2.4 各模式完整色板

| 元素 | 浅色模式 | 暗黑模式 |
|------|---------|---------|
| 蜡烛体顶部 | `#FAF0DC` | `#E8DCC8` |
| 蜡烛体底部 | `#F0E0C0` | `#D4C4A0` |
| 蜡烛体描边 | `#C49450` | `#9C8B70` |
| 蜡烛体高光 | `#FFF8E8` | `#F5ECD8` |
| 火焰外层起 | `#FFD080` | `#FFD080` |
| 火焰外层止 | `#F0A830` | `#F0A830` |
| 火焰中层起 | `#FFB850` | `#FFB850` |
| 火焰中层止 | `#E88A10` | `#E88A10` |
| 火焰内层起 | `#FFFCE8` | `#FFFCE8` |
| 火焰内层止 | `#FFF0D0` | `#FFF0D0` |
| 光晕色 | `#FFE0A0` | `#FFE0A0` |
| 蜡芯色 | `#6B5840` | `#4A4038` |
| 底座填充 | `#D8D0C0` | `#55524E` |
| 底座描边 | `#B8A898` | `#7A756E` |
| 融化弧填充 | `#FFF8E8` | `#F0E0C8` |
| 融化弧描边 | `#C49450` | `#9C8B70` |
| 蜡滴填充 | `#FAF0DC` | `#E8DCC8` |

> 注意：火焰颜色在浅色和暗黑模式下保持相同，以营造一致的温暖光感。

### 7.3 CSS 动画

#### 7.3.1 火焰摇曳（三层独立频率）

外层火焰、中层火焰和内层亮心各自以不同速率摇晃，模拟真实火焰的复杂动态：

```css
@keyframes flame-flicker-outer {
  0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
  25% { transform: scaleX(1.04) scaleY(0.98) translateY(0.5px); }
  50% { transform: scaleX(0.97) scaleY(1.02) translateY(-0.5px); }
  75% { transform: scaleX(1.02) scaleY(0.99) translateY(0.3px); }
  /* duration: 2s, easing: ease-in-out, infinite */
}

@keyframes flame-flicker-middle {
  0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
  30% { transform: scaleX(1.06) scaleY(0.97) translateY(0.8px); }
  60% { transform: scaleX(0.95) scaleY(1.03) translateY(-0.4px); }
  /* duration: 1.8s, easing: ease-in-out, infinite */
}

@keyframes flame-flicker-inner {
  0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
  20% { transform: scaleX(1.08) scaleY(0.96) translateY(0.6px); }
  50% { transform: scaleX(0.96) scaleY(1.02) translateY(-0.3px); }
  80% { transform: scaleX(1.04) scaleY(0.98) translateY(0.4px); }
  /* duration: 1.4s, easing: ease-in-out, infinite */
}
```

#### 7.3.2 光晕脉动

```css
@keyframes halo-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
  /* duration: 3s, easing: ease-in-out, infinite */
}
```

#### 7.3.3 动画参数汇总

| 动画名称 | 持续时间 | 缓动函数 | 变换原点 | 频率感 |
|---------|---------|---------|---------|--------|
| `flame-flicker-outer` | 2s | ease-in-out | bottom center | 慢/主频 |
| `flame-flicker-middle` | 1.8s | ease-in-out | bottom center | 中频 |
| `flame-flicker-inner` | 1.4s | ease-in-out | bottom center | 快/高频 |
| `halo-pulse` | 3s | ease-in-out | center | 呼吸感 |

#### 7.3.4 同步状态脉动

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
  /* duration: 1.2s, infinite */
}
```

用于侧栏同步状态指示灯（`.status-dot.syncing`）。

### 7.4 日状态透明度映射

| 状态 | 蜡烛体 opacity | 火焰 opacity |
|------|---------------|-------------|
| **活力（vitality）** | 1.0 | 1.0 |
| **复苏（recovery）** | 0.85 | 0.88 |
| **倦意（withered）** | 0.6 | 0.5 |

### 7.5 状态色变量映射

养成系统中状态色彩通过 CSS 变量动态绑定，而非硬编码 hex 值：

| 日状态 | CSS 颜色变量 |
|--------|------------|
| 活力 | `var(--color-success-text)` |
| 复苏 | `var(--color-warning-text)` |
| 倦意 | `var(--color-text-3)` |

### 7.6 XP 来源标签色彩

| 来源 | CSS 颜色变量 | 中文标签 |
|------|------------|---------|
| complete | `var(--color-success-text)` | 完成 |
| priority | `var(--color-danger-text)` | 高优先 |
| night | `var(--color-accent-text)` | 夜行 |
| deadline | `var(--color-info-text)` | 准时 |
| streak | `var(--color-warning-text)` | 连续 |
| achievement | `var(--color-warning-text)` | 成就 |

### 7.7 进度条渐变

```css
background: linear-gradient(90deg, var(--color-warning), var(--color-primary));
```

左端警告色（金黄色）→ 右端主色（蓝色/红色），传达"积累→达成"的进度语义。

---

## 8. 响应式设计

### 8.1 PC 端布局（桌面优先）

CleanNotes 采用桌面优先策略，PC 端为默认布局：

```
┌──────────┬──────────────────────────────────┐
│          │                                  │
│ Sidebar  │         Main Content             │
│ (220px)  │         (flex: 1)                │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

**核心布局 CSS**（`App.vue`）：

```css
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg-1);
}
.app-main {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;  /* 防止 flex 子项撑开 */
}
```

**侧栏尺寸**：
```css
.sidebar {
  width: 220px;        /* 固定宽度 */
  flex-shrink: 0;      /* 不可收缩 */
  padding: 20px 16px 16px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}
```

**弹窗尺寸**：
| 弹窗 | PC 宽度 |
|------|--------|
| 任务编辑弹窗 | `600px`、`max-width: 92vw` |
| README 模态 | `720px`、`max-width: 90vw` |
| 登录表单卡片 | `420px` |

### 8.2 H5 移动端适配

#### 8.2.1 移动端检测与路由

CleanNotes 通过 `isMobileDevice()` 工具函数检测移动设备，自动跳转到 H5 路由：

- **路由前缀**：`/h5/`
- **H5 页面不渲染 PC 侧栏**：`App.vue` 中通过 `isH5Route` 判断跳过 `.app-shell` 渲染

#### 8.2.2 登录页响应式断点

登录页定义了响应式断点，当视口宽度 ≤ `860px` 时切换为垂直布局：

```css
@media (max-width: 860px) {
  .login-page {
    flex-direction: column;  /* 左右布局 → 上下布局 */
  }
  .login-left {
    flex: 0 0 auto;          /* 品牌面板收窄 */
    padding: 40px 32px 20px;
  }
  .left-title { font-size: 24px; }  /* 标题缩小 */
  .clock-widget { display: none; }  /* 隐藏时钟 */
  .feature-list { display: none; }  /* 隐藏功能列表 */
  .login-right {
    padding: 20px 24px 40px;
    align-items: flex-start;  /* 表单向上对齐 */
  }
  .form-card {
    width: 100%;
    max-width: 420px;
    padding: 32px 28px;
  }
}
```

#### 8.2.3 移动端适配要点

- 侧栏在 H5 路由完全不渲染，改为底部导航或全屏内容
- 弹窗使用 `max-width: 92vw`（编辑弹窗）和 `max-width: 90vw`（README 模态）自适应
- 登录页品牌区（左侧面板）在移动端收缩，隐藏装饰性元素（时钟、功能列表）

---

## 附录 A：完整 CSS 变量速查表

### A.1 腾讯蓝主题（默认）

| 变量 | 值 |
|------|---|
| `--color-primary` | `#0052D9` |
| `--color-primary-light` | `#EDF1FF` |
| `--color-primary-hover` | `#003CAB` |
| `--color-primary-disabled` | `#8EABFF` |
| `--color-success` | `#0052D9` |
| `--color-success-text` | `#003CAB` |
| `--color-warning` | `#E37318` |
| `--color-warning-text` | `#BE5A00` |
| `--color-danger` | `#D54941` |
| `--color-danger-text` | `#AD352F` |
| `--color-info` | `#0052D9` |
| `--color-info-text` | `#003CAB` |
| `--color-accent` | `#7C3AED` |
| `--color-accent-text` | `#5B21B6` |
| `--color-text-1` | `#0F172A` |
| `--color-text-2` | `#475569` |
| `--color-text-3` | `#64748B` |
| `--color-text-4` | `#9CA3AF` |
| `--color-bg-1` | `#F3F3F4` |
| `--color-bg-2` | `#EEEEF0` |
| `--color-bg-3` | `#E7E8EB` |
| `--color-bg-4` | `#DCDDE1` |
| `--color-surface` | `#FFFFFF` |
| `--color-border` | `#D5D6DA` |
| `--color-border-light` | `#E0E1E5` |
| `--color-focus-ring` | `rgba(0,82,217,0.10)` |

### A.2 暗黑模式

| 变量 | 值 |
|------|---|
| `--color-primary` | `#6b81f8` |
| `--color-success` | `#4d8fff` |
| `--color-warning` | `#fbbf24` |
| `--color-danger` | `#f87171` |
| `--color-info` | `#60a5fa` |
| `--color-accent` | `#a78bfa` |
| `--color-text-1` | `#f1f5f9` |
| `--color-text-4` | `#64748b` |
| `--color-bg-1` | `#0f1115` |
| `--color-surface` | `#1a1b20` |
| `--color-border` | `#2e3038` |

### A.3 ZURU 品牌色

| 变量 | 值 |
|------|---|
| `--color-primary` | `#CB312D` |
| `--color-primary-hover` | `#AD2A26` |
| `--color-primary-disabled` | `#E59895` |
| `--color-info` | `#999999` |
| `--color-text-1` | `#1A1A1A` |
| `--color-text-4` | `#BFBFBF` |
| `--color-bg-1` | `#F1F3F6` |
| `--color-surface` | `#FFFFFF` |
| `--color-border` | `#DFE2E6` |

---

## 附录 B：过渡动画规范

| 过渡属性 | 持续时间 | 缓动函数 | 使用场景 |
|---------|---------|---------|---------|
| `all` | `0.12s` | 默认（ease） | 任务项背景、优先级按钮、标签页切换、工具栏按钮 |
| `all` | `0.15s` | 默认 | 退出按钮、导航项、弹窗关闭、按钮悬停、输入框焦点 |
| `all` | `0.15s` | `ease` | 导航项 |
| `background` | `0.12s` | 默认 | 任务项悬停 |
| `border-color` / `box-shadow` | `0.15s` | 默认 | 输入框焦点 |
| `opacity` | `0.15s` | 默认 | 主按钮悬停、版本信息、README 入口 |
| `background` | `0.2s` | 默认 | 登录按钮 |
| `transform` | `0.1s` | 默认 | 登录按钮按下 |
| `box-shadow` / `transform` | `0.2s` | `ease` | 养成部件卡片悬停 |
| `width` | `0.6s` | `ease` | 经验值进度条 |
| `all` | `0.6s` | `ease` | 蜡烛 SVG 整体过渡 |
| `background` | `0.3s` | `ease` | 状态指示灯 |
| XP Toast 进入 | `0.35s` | `cubic-bezier(0.34,1.56,0.64,1)` | 弹性回弹进入 |
| XP Toast 离开 | `0.25s` | `ease` | 平滑淡出 |
| 登录页时钟翻转 | `0.35s` | `cubic-bezier(0.4,0,0.2,1)` | 数字翻页效果 |

---

## 附录 C：滚动条样式

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-text-3); }
```

---

## 附录 D：任务优先级/状态色彩映射

以下为 `TaskEditModal.vue` 中动态计算的主题感知色彩（含四主题全值）：

### 优先级

| 优先级 | 腾讯蓝文字色 | 腾讯蓝浅底色 | 暗黑文字色 | 暗黑浅底色 | ZURU 文字色 | ZURU 浅底色 |
|--------|-----------|-----------|----------|----------|----------|----------|
| **高** | `#f87171`（红） | `#EDF1FF` | `#f87171` | `#2d1516` | `#CB312D` | `#F9EBEB` |
| **中** | `#0052D9`（蓝） | `#EDF1FF` | `#60a5fa` | `#162032` | `#999999` | `#F5F5F5` |
| **低** | `#00a870`（绿） | `#E8F8EE` | `#4ade80` | `#0f2e1c` | `#BFBFBF` | `#F5F5F5` |

### 状态

| 状态 | 腾讯蓝文字色 | 腾讯蓝浅底色 | 暗黑文字色 | 暗黑浅底色 | ZURU 文字色 | ZURU 浅底色 |
|------|-----------|-----------|----------|----------|----------|----------|
| **待办** | `#666666` | `#F5F5F5` | `#cbd5e1` | `#252730` | `#666666` | `#F5F5F5` |
| **进行中** | `#0052D9` | `#EDF1FF` | `#fbbf24` | `#2d2006` | `#AD2A26` | `#FFF5F5` |
| **已完成** | `#00a870` | `#E8F8EE` | `#4ade80` | `#0f2e1c` | `#CB312D` | `#F9EBEB` |
