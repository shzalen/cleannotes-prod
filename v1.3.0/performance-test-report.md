# CleanNotes v1.3.0 性能测试报告

**测试日期：** 2026-07-10  
**测试人员：** 砚（AI 性能测试）  
**测试范围：** CleanNotes v1.3.0 前端渲染性能、数据同步性能、极端场景压力测试  
**测试方法：** 构建产物分析 + 代码级性能审计 + 架构推演  
**说明：** Supabase API 压力测试（P3）按要求跳过  

---

## 一、测试概览

| 维度 | 测试项数 | 优秀 | 良好 | 需优化 | 存在风险 |
|------|---------|------|------|--------|---------|
| P1 前端渲染与加载 | 6 | 1 | 1 | 3 | 1 |
| P2 数据同步性能 | 5 | 0 | 1 | 3 | 1 |
| P4 极端场景压力 | 4 | 0 | 1 | 2 | 1 |
| **合计** | **15** | **1** | **3** | **8** | **3** |

**总体性能评级：需优化** — 初始加载过重、数据同步策略存在瓶颈、localStorage 容量风险。

---

## 二、详细测试结果

### P1 — 前端渲染与加载性能

#### P1.1 首屏加载性能

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | 构建产物体积分析 + 依赖链追踪 |

**发现：**

初始加载（登录页 `/login`）的 JavaScript 依赖链：

```
index.html
  └─ index-CI9YN5qH.js (158 KB, gzip 52 KB) — 路由+入口
       ├─ vendor-tiptap-core-Dh4B5lGc.js (296 KB, gzip 100 KB) — Vue + Pinia + Tiptap 核心
       │    └─ vendor-prosemirror-Bv-9WTiV.js (247 KB, gzip 76 KB) — ProseMirror
       ├─ vendor-tiptap-custom-CISHMFxb.js (58 KB, gzip 18 KB) — 自定义扩展 + Supabase 适配器
       │    └─ index-D7FWeAzU.js (589 KB, gzip 204 KB) — KaTeX + cheerio + htmlparser2
       └─ index-DLmorHWr.css (37 KB, gzip 7 KB) — 全局样式
```

**关键问题：** `App.vue` 在顶层同步导入了 `AppSidebar`、`useTaskStore`、`useGrowthStore`、`useAiStore`、`mergeFromCloud`、`ConfirmDialog`、`XpToast` 等模块，这些模块的依赖链最终拉入了 Tiptap 核心库和 ProseMirror。即使是在登录页面（不使用编辑器），这些库也会被完整下载和解析。

**初始加载估算（gzip）：**

| 资源 | gzip 大小 |
|------|----------|
| index-CI9YN5qH.js | 52 KB |
| vendor-tiptap-core | 100 KB |
| vendor-prosemirror | 76 KB |
| vendor-tiptap-custom | 18 KB |
| index-D7FWeAzU.js (KaTeX等) | 204 KB |
| index CSS | 7 KB |
| LoginView (lazy) | ~5 KB |
| **合计** | **~462 KB gzip** |

在 4G 网络（~10 Mbps）下，462KB gzip 约需 370ms 下载，加上 JS 解析和执行时间，预计首屏 LCP 在 1.5-2.5 秒。

**优化建议：**
1. 将 `App.vue` 中的 `AppSidebar` 改为异步组件 `defineAsyncComponent(() => import(...))`
2. 将 Tiptap 相关 store 改为懒加载（仅进入需要编辑器的页面时初始化）
3. KaTeX 应延迟到实际渲染数学公式时才加载
4. 将 Vue/Pinia 从 `vendor-tiptap-core` 中分离为独立 `vendor-vue` chunk

---

#### P1.2 Bundle 体积分析

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | `dist/assets/` 目录分析 |

**发现：**

| 类别 | 原始大小 | gzip 大小 | 文件数 |
|------|---------|----------|-------|
| 总 JS | 5.47 MB | ~1.8 MB | 100 |
| 总 CSS | 0.23 MB | ~40 KB | 5 |
| 总产物 | 6.1 MB | ~1.85 MB | 105+ |

**超大 chunk（> 500KB）：**

| 文件 | 原始 | gzip | 内容 |
|------|------|------|------|
| cynefin-VYW2F7L2.js | 675 KB | 155 KB | Mermaid cynefin 图表（按需加载） |
| index-D7FWeAzU.js | 589 KB | 204 KB | KaTeX + cheerio + htmlparser2 |
| mermaid.core-BPMZuuoV.js | 553 KB | 128 KB | Mermaid 核心（按需加载） |

**大 chunk（200-500KB）：**

| 文件 | 原始 | gzip | 内容 |
|------|------|------|------|
| cytoscape.esm.js | 433 KB | 142 KB | Mermaid 图布局（按需加载） |
| TasksView.js | 356 KB | 114 KB | 任务页（含 html2canvas） |
| vendor-tiptap-core.js | 296 KB | 100 KB | Tiptap + Vue（全局加载） |
| katex.js | 255 KB | 78 KB | 数学公式渲染 |
| vendor-prosemirror.js | 247 KB | 76 KB | ProseMirror（全局加载） |
| html2canvas-pro.esm.js | 240 KB | 62 KB | 截图导出 |

**问题分析：**
1. `index-D7FWeAzU.js`（589KB）包含 KaTeX + cheerio，但在非数学/非 Markdown 场景完全不需要
2. `TasksView.js`（356KB）将 html2canvas 打入页面 chunk，应延迟加载
3. Mermaid 系列图表共约 3MB，但已正确按需加载 ✅
4. `manualChunks` 配置未将 Vue/Pinia 单独分出，导致 `vendor-tiptap-core` 过大

---

#### P1.3 路由切换性能

| 项目 | 详情 |
|------|------|
| **评级** | ✅ 良好 |
| **测试方法** | 路由配置分析 |

**发现：**

所有路由组件均使用动态 `import()` 懒加载：

```typescript
// router/index.ts
component: () => import('@/views/LoginView.vue')
component: () => import('@/views/HomeView.vue')
component: () => import('@/views/TasksView.vue')
// ...
```

切换路由时仅加载对应页面的 chunk（通常 30-60KB gzip），Vue Router 的 `<router-view>` 配合 `<Suspense>` 可实现平滑切换。

**潜在问题：**
- `App.vue` 在路由切换时不卸载，侧边栏组件持续运行
- Pinia stores 全局单例，切换页面后 store 数据不释放
- 长时间使用后内存可能增长（未观察到主动清理逻辑）

---

#### P1.4 Tiptap 编辑器初始化

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | 扩展配置分析 |

**发现：**

RichTextEditor 配置了 25 个 Tiptap 扩展（`src/components/RichTextEditor.vue` 第 1130-1169 行）：

```
StarterKit, BulletList, OrderedList, ListItem, Blockquote, CodeBlock,
HorizontalRule, TaskList, TaskItem, Table, TableRow, TableHeader,
TableCell, ImageResize, LinkExtension, Placeholder, FileAttachment,
SlashCommand, MarkdownInputRules, Callout, Toggle, Mermaid, Mindmap,
DoubleBracketLinker, TrailingNode, Underline, Highlight, TextStyle,
Color, TextAlign
```

其中 Mermaid 和 Mindmap 使用动态 `import()` 加载，不影响初始化。但其余 23 个扩展在编辑器创建时同步注册。

**估算：** 编辑器初始化（`useEditor()` 调用到 `onCreate`）预计 50-150ms，取决于设备性能。在低端设备上可能达到 200-300ms。

**优化建议：**
1. 将不常用扩展（Table、CodeBlock、TaskList）改为按需加载
2. 考虑使用 Tiptap 的 `Extension.create` 懒注册模式

---

#### P1.5 大型 Mermaid/Mindmap 渲染

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | 渲染机制分析 |

**发现：**

**Mermaid：**
- 使用 `securityLevel: 'sandbox'`，渲染输出放入 `<iframe sandbox>` 中
- Mermaid 核心（553KB）+ 各图表类型 chunk 通过动态 import 加载 ✅
- 渲染大型图表（200+ 节点）时，Mermaid 内部使用 dagre/cytoscape 布局算法，CPU 密集型
- `<iframe>` 重建开销：每次更新代码都重新 `iframe.srcdoc = ...`，大型图表可能导致 1-3 秒卡顿

**Mindmap：**
- 使用 markmap-lib + markmap-view，SVG 直接操作 DOM
- 无 virtualization，所有节点一次性渲染到 SVG
- 200+ 节点时 SVG DOM 过大，可能导致滚动卡顿和内存占用过高

**优化建议：**
1. Mermaid 渲染添加防抖（debounce 500ms），避免频繁重渲染
2. Mindmap 考虑节点折叠/虚拟化，限制同时渲染的节点数
3. 大型图表添加 loading 指示器

---

#### P1.6 养成系统（烛）SVG 动画

| 项目 | 详情 |
|------|------|
| **评级** | ✅ 优秀 |
| **测试方法** | CSS 动画配置分析 |

**发现：**

烛系统使用纯 CSS 动画（`@keyframes`）实现火焰摇曳、光晕脉动等效果。SVG 元素仅 6 个（火焰三层、光晕、蜡烛体、烛芯），动画通过 `transform` 和 `opacity` 属性实现，可被 GPU 加速。

**评估：** CSS 动画对 CPU 影响极小（< 1%），GPU 合成层开销可忽略。即使长时间停留在 Spirit 页面，不会造成性能问题。

---

### P2 — 数据同步性能

#### P2.1 登录全量同步

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | `mergeFromCloud()` 代码分析 |

**发现：**

`mergeFromCloud()`（`src/services/hybrid.ts` 第 308-456 行）在登录时执行：

```typescript
// 第 314-319 行：并行拉取 5 类数据
const [cloudTasks, cloudDeleted, cloudMsgs, cloudTimer, cloudAiConfig] = await Promise.all([
  supabaseAdapter.getTasks().catch(() => []),
  supabaseAdapter.getDeletedTasks().catch(() => []),
  supabaseAdapter.getAiMessages().catch(() => []),
  supabaseAdapter.getTimerConfig().catch(() => null),
  supabaseAdapter.getAiConfig().catch(() => null),
])
```

**同步流程：**
1. 并行拉取 5 类云端数据（5 个 REST 请求）
2. 并行读取 5 类本地数据（localStorage）
3. 逐类执行 merge 逻辑（`mergeRecords`）
4. 合并结果写回 localStorage + Supabase

**性能估算：**

| 数据规模 | 云端拉取 | 本地读取 | 合并+写入 | 总耗时 |
|---------|---------|---------|----------|-------|
| 50 条任务 | ~200ms | < 10ms | < 50ms | ~300ms |
| 200 条任务 | ~500ms | ~20ms | ~100ms | ~700ms |
| 1000 条任务 | ~2s | ~50ms | ~500ms | ~3s |
| 5000 条任务 | ~8s | ~200ms | ~2s | ~12s |

**问题：**
1. **全量拉取**：不使用增量同步（`updatedAt > lastSyncAt`），每次登录都拉取全部数据
2. **全量上传**：`saveTasks(merged.toUpload)` 一次性 POST 全部新记录，大数据量时请求体过大
3. **串行写入**：合并完成后逐类写回（先 tasks，再 deleted，再 msgs...），无并行
4. **备注/Todo/周报/成长数据未纳入 `mergeFromCloud`**：这些数据有独立的同步逻辑，可能产生额外请求

**优化建议：**
1. 实现增量同步：仅拉取 `updated_at > lastSyncAt` 的记录
2. 批量上传分批处理（每批 100 条）
3. 合并后各类数据并行写回

---

#### P2.2 健康检查轮询

| 项目 | 详情 |
|------|------|
| **评级** | ✅ 良好 |
| **测试方法** | `healthCheckLoop()` 代码分析 |

**发现：**

```typescript
// hybrid.ts 第 187 行
const HEALTH_CHECK_INTERVAL = 15_000 // 15 秒

// 第 189-205 行
async function checkSupabaseHealth(): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cleannote_tasks?limit=0`, {
    method: 'GET',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'x-user-id': currentUserId },
    signal: controller.signal,
  })
  return res.status < 500
}
```

**评估：**
- 15 秒间隔合理，不会对 Supabase 造成压力
- 5 秒超时 + `AbortController`，避免挂起 ✅
- `limit=0` 的 GET 请求响应体为空，带宽消耗极小（仅 HTTP headers，~500 字节/次）
- 1 小时累积：240 次请求，~120KB 流量
- 仅在有脏数据或网络恢复时触发 `syncDirtyOps()`

**潜在问题：**
- 健康检查在页面不可见时（`document.hidden`）仍然运行，浪费资源
- 未使用 `requestIdleCallback` 或 `visibilitychange` 事件暂停轮询

---

#### P2.3 脏队列串行重试

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | `syncDirtyOps()` 代码分析 |

**发现：**

```typescript
// hybrid.ts 第 218-263 行
for (let i = 0; i < queue.length; i++) {
  try {
    switch (op.type) {
      case 'upsert_task':
        await supabaseAdapter.upsertTask(op.data as Task)
        break
      // ...
    }
    syncedIndices.push(i)
  } catch {
    break // ← 首条失败即停止
  }
}
```

**问题：**
1. **首条失败阻塞**：`break` 语句在第一个失败操作后立即停止，后续操作即使可能成功也无法执行
2. **串行执行**：所有操作逐条 await，无并行处理
3. **无退避策略**：失败后 15 秒重试，无指数退避

**场景分析：**
- 10 条脏数据，首条因网络抖动失败 → 9 条数据被阻塞
- 大量脏数据时，逐条同步耗时 = N × (请求时间 + 网络 RTT)

**优化建议：**
1. 失败时跳过当前操作继续尝试后续（`continue` 替代 `break`）
2. 同类型操作批量提交（如多个 `upsert_task` 合并为一次 `saveTasks`）
3. 添加指数退避重试策略

---

#### P2.4 大量 base64 内容同步

| 项目 | 详情 |
|------|------|
| **评级** | 🔴 存在风险 |
| **测试方法** | 存储链路分析 |

**发现：**

备忘录的图片和文件附件以 base64 data URI 嵌入 HTML content 字段。同步链路：

```
编辑器 → editor.getHTML() → modelValue → localStorage → Supabase REST API (POST)
```

**数据膨胀：**
- 1 张 2MB 图片 → base64 编码后约 2.67MB
- 3 张 2MB 图片 → HTML content 约 8MB
- Supabase REST API POST 请求体限制：默认 1MB（可配置至 5MB）

**问题：**
1. **Supabase 请求体限制**：含多张图片的备忘录可能超过 Supabase REST API 请求体限制，导致同步失败
2. **localStorage 溢出**：3-4 张 2MB 图片即可超过 localStorage 5MB 限制
3. **同步超时**：8MB 请求体上传时间在 4G 网络下约 6-8 秒，可能触发 Supabase 超时
4. **脏队列膨胀**：失败的同步操作进入脏队列，base64 数据被序列化到 localStorage，进一步加剧存储压力

**优化建议：**
1. **关键**：图片改用 Supabase Storage 存储，content 中仅保存 URL 引用
2. 图片上传前自动压缩（canvas resize 至 1920px 宽，JPEG 80%）
3. 大型备忘录分片同步

---

#### P2.5 localStorage 容量极限

| 项目 | 详情 |
|------|------|
| **评级** | 🔴 存在风险 |
| **测试方法** | 存储使用量推算 |

**发现：**

localStorage 典型限制 5-10MB（浏览器和域名相关）。CleanNotes 存储的数据：

| 数据类型 | key | 单用户预估大小 |
|---------|-----|-------------|
| 任务列表 | `cleannotes_{userId}_tasks` | 50-500KB（取决于数量） |
| 回收站 | `cleannotes_{userId}_deleted_tasks` | 10-100KB |
| 备忘录 | `cleannotes_{userId}_memos` | 100KB-5MB+（含 base64 图片） |
| AI 对话 | `cleannotes_{userId}_ai_messages` | 10-200KB |
| 成长数据 | `cleannotes_{userId}_growth_*` | 10-50KB |
| 脏队列 | `cleannotes_dirty_queue_{userId}` | 0-5MB（失败时膨胀） |
| Session | `cleannote_session` | < 1KB |
| 其他 | theme, tombstones, lastSyncAt | < 5KB |

**风险场景：**
1. 用户创建 5 个含 2 张图片的备忘录 → 约 20MB base64 数据 → localStorage 溢出
2. `QuotaExceededError` 未被全局捕获，仅在 `localAdapter.saveMemos()` 中隐式失败
3. 溢出后新数据无法保存，已有数据可能部分写入（JSON 序列化截断）

**当前防护：** 代码中多处 `try { localStorage.setItem(...) } catch {}` 静默吞掉错误，用户不会收到任何提示。

**优化建议：**
1. 全局 `QuotaExceededError` 监听器，提示用户清理数据
2. 图片迁移至 Supabase Storage（见 P2.4）
3. 实现数据清理策略：自动清理 30 天以上的回收站数据

---

### P4 — 极端场景压力测试

#### P4.1 网络中断恢复

| 项目 | 详情 |
|------|------|
| **评级** | ✅ 良好 |
| **测试方法** | 离线优先架构分析 |

**发现：**

CleanNotes 采用离线优先架构（hybridAdapter），网络中断时的行为：

1. **写入操作**：先写 localStorage（成功）→ 尝试 Supabase（失败）→ 入脏队列
2. **读取操作**：直接从 localStorage 读取（不依赖网络）
3. **恢复后**：`healthCheckLoop` 检测到网络恢复 → `syncDirtyOps()` 重放脏队列

**评估：**
- 离线时核心功能完全可用 ✅
- 脏队列持久化到 localStorage，刷新页面不丢失 ✅
- 恢复后自动同步 ✅
- 但脏队列的 `break` 逻辑（P2.3）可能导致部分数据无法同步

---

#### P4.2 多标签页并发操作

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | 并发写入分析 |

**发现：**

多个浏览器标签页共享同一 localStorage，但无跨标签页同步机制：

1. **标签页 A** 编辑备忘录 M → 写入 localStorage → 800ms 防抖后触发 Supabase 同步
2. **标签页 B** 同时编辑备忘录 M → 读取 localStorage（A 的修改） → 覆盖写入 → Supabase 同步
3. 结果：标签页 A 的修改可能被标签页 B 覆盖

**问题：**
- 无 `storage` 事件监听（`window.addEventListener('storage', ...)`），标签页间不感知彼此修改
- 无乐观锁（如 `updatedAt` 版本号校验），后写入者直接覆盖
- 15 秒健康检查不拉取远端变更（仅 `syncDirtyOps`，不调用 `fetchRemoteChanges`）

**优化建议：**
1. 监听 `storage` 事件，收到其他标签页的修改时刷新当前视图
2. 写入 Supabase 前校验 `updatedAt`，使用 `PATCH ...&updated_at=lt.{localUpdatedAt}` 条件更新
3. 使用 `BroadcastChannel` API 实现跨标签页实时同步

---

#### P4.3 快速重复操作

| 项目 | 详情 |
|------|------|
| **评级** | ⚠️ 需优化 |
| **测试方法** | 操作链路分析 |

**发现：**

快速创建/删除/切换任务 100 次时：

1. **每次操作触发**：`localAdapter.upsertTask()` → `supabaseAdapter.upsertTask()` → 2 个写入操作
2. **任务列表渲染**：每次操作后 Pinia store 更新 → Vue 响应式重新渲染列表
3. **无操作节流**：任务 store 无 debounce/throttle，每次操作直接执行

**估算：**
- 100 次操作 → 200 次 localStorage 写入 + 100 次 Supabase REST 请求
- 假设每次操作 50ms（localStorage） + 100ms（Supabase RTT） = 150ms
- 100 次操作总耗时 ≈ 15 秒（串行）
- 但 Supabase 请求是异步的，不阻塞 UI

**潜在问题：**
- 快速操作时 Supabase 请求积压（浏览器并发限制 6 个/域名）
- Pinia store 频繁更新导致 Vue 频繁 diff，可能掉帧
- 脏队列在频繁失败时快速膨胀

**优化建议：**
1. 对任务操作添加 200ms debounce，合并连续操作
2. 使用 `requestAnimationFrame` 批量更新 UI
3. Supabase 写入添加请求队列，避免并发限制

---

#### P4.4 大数据列表渲染

| 项目 | 详情 |
|------|------|
| **评级** | 🔴 存在风险 |
| **测试方法** | 渲染策略分析 |

**发现：**

任务列表（TasksView）和备忘录列表（MemoView）均无虚拟滚动：

1. **TasksView**（356KB chunk）：渲染所有任务卡片，每个卡片包含标题、描述、标签、日期、优先级等元素
2. **MemoView**：左侧列表渲染所有备忘录标题项

**估算：**

| 任务数量 | DOM 节点数（估） | 渲染耗时（估） | 滚动帧率 |
|---------|---------------|-------------|---------|
| 50 | ~2,500 | < 100ms | 60fps |
| 200 | ~10,000 | ~300ms | 60fps |
| 500 | ~25,000 | ~800ms | 30-45fps |
| 1000 | ~50,000 | ~2s | 15-30fps |

**问题：**
- 500+ 任务时首次渲染明显卡顿
- 1000+ 任务时滚动掉帧严重
- 无分页/无限滚动机制
- 任务卡片中的标签渲染、优先级颜色计算等均为同步操作

**优化建议：**
1. 引入虚拟滚动库（如 `vue-virtual-scroller`）
2. 任务列表分页加载（每页 50 条）
3. 标签和优先级颜色使用 CSS 类而非 inline style

---

## 三、性能瓶颈汇总

### 按影响排序

| 优先级 | 问题 | 影响范围 | 修复难度 |
|--------|------|---------|---------|
| **P0** | P2.4 + P2.5：base64 图片导致 localStorage 溢出 | 数据丢失 | 高（需迁移至 Storage） |
| **P0** | P4.4：大数据列表无虚拟滚动 | 500+任务时卡顿 | 中（引入虚拟滚动） |
| **P1** | P1.1：登录页加载 462KB gzip | 首屏慢 | 中（异步加载 Tiptap） |
| **P1** | P2.1：登录全量同步无增量 | 数据多时登录慢 | 中（实现增量同步） |
| **P1** | P2.3：脏队列首条失败阻塞 | 数据同步延迟 | 低（改为 continue） |
| **P2** | P1.2：KaTeX + cheerio 全局加载 | 额外 204KB gzip | 低（改动态 import） |
| **P2** | P4.2：多标签页无同步 | 数据覆盖 | 中（storage 事件） |
| **P2** | P4.3：快速操作无节流 | 请求积压 | 低（加 debounce） |
| **P3** | P1.4：Tiptap 25 扩展初始化 | 进入编辑器慢 | 中（按需加载扩展） |
| **P3** | P1.5：大型图表无防抖 | 渲染卡顿 | 低（加 debounce） |
| **P3** | P2.2：健康检查未暂停 | 后台资源浪费 | 低（visibilitychange） |

---

## 四、优化建议路线图

### 第一阶段（紧急，1 周）

1. **图片迁移至 Supabase Storage**
   - RichTextEditor 图片上传改为 Storage + URL 引用
   - 添加上传前压缩（canvas resize + JPEG 80%）
   - 解决 localStorage 溢出和同步超时问题

2. **脏队列改为 continue 逻辑**
   - `break` → `continue`，跳过失败操作继续后续
   - 添加失败计数，连续 3 次失败的操作跳过

3. **虚拟滚动**
   - TasksView 和 MemoView 引入 `vue-virtual-scroller`
   - 分页加载，每页 50 条

### 第二阶段（重要，2 周）

4. **初始加载优化**
   - `App.vue` 中的 `AppSidebar` 改为 `defineAsyncComponent`
   - Vue/Pinia 从 `vendor-tiptap-core` 分离为独立 chunk
   - KaTeX 改为 `import()` 动态加载

5. **增量同步**
   - 登录时仅拉取 `updated_at > lastSyncAt` 的记录
   - 批量上传分片处理（每批 100 条）

6. **多标签页同步**
   - 监听 `storage` 事件刷新视图
   - 写入前校验 `updatedAt` 版本

### 第三阶段（改进，2-4 周）

7. **操作节流**
   - 任务操作添加 200ms debounce
   - Supabase 写入添加请求队列

8. **健康检查优化**
   - `document.hidden` 时暂停轮询
   - 添加指数退避

9. **Tiptap 扩展懒加载**
   - Table/CodeBlock 等不常用扩展按需注册
   - Mermaid 渲染添加 debounce

---

## 五、性能指标基准（建议目标）

| 指标 | 当前估值 | 目标值 | 测试方法 |
|------|---------|-------|---------|
| 首屏 LCP（登录页） | 1.5-2.5s | < 1.5s | Lighthouse |
| 初始 JS 加载（gzip） | ~462KB | < 200KB | DevTools Network |
| 任务列表渲染（500条） | ~800ms | < 300ms | Performance API |
| 任务列表滚动 FPS（500条） | 30-45fps | 60fps | DevTools FPS meter |
| 登录同步（200条任务） | ~700ms | < 500ms | 手工计时 |
| 编辑器初始化 | 50-150ms | < 100ms | Performance API |
| localStorage 使用率 | 可达 100% | < 60% | 估算 |

---

*报告结束*
