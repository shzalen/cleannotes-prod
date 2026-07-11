# CleanNotes v1.3.0 安全测试报告

**测试日期：** 2026-07-10  
**测试人员：** 砚（AI 安全测试）  
**测试范围：** CleanNotes v1.3.0 全部前端代码 + Supabase 后端配置  
**测试方法：** 白盒代码审计 + 构建产物分析 + 依赖漏洞扫描  

---

## 一、测试概览

| 维度 | 测试项数 | 致命 | 高危 | 中危 | 低危 | 通过 |
|------|---------|------|------|------|------|------|
| S1 认证与会话安全 | 4 | 1 | 2 | 1 | 0 | 0 |
| S2 数据隔离与 RLS 绕过 | 3 | 2 | 0 | 1 | 0 | 0 |
| S3 XSS 注入测试 | 5 | 0 | 3 | 1 | 1 | 0 |
| S4 敏感信息泄露 | 3 | 1 | 1 | 1 | 0 | 0 |
| S5 文件上传安全 | 3 | 0 | 0 | 2 | 1 | 0 |
| S6 客户端存储安全 | 2 | 0 | 0 | 2 | 0 | 0 |
| S7 供应链与依赖安全 | 2 | 0 | 0 | 1 | 1 | 0 |
| **合计** | **22** | **4** | **6** | **9** | **3** | **0** |

**总体安全评级：高风险** — 存在 4 项致命漏洞，可被直接利用获取任意用户数据。

---

## 二、详细测试结果

### S1 — 认证与会话安全

#### S1.1 验证码绕过测试

| 项目 | 详情 |
|------|------|
| **严重度** | 🔴 致命 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/stores/auth.ts` 第 100-125 行 |

**发现：**

`verifyAndRegister()` 函数（第 101 行）仅校验验证码格式 `/^\d{6}$/`，不校验验证码内容。代码注释明确写道："MVP：任何6位数字均可通过"。

```typescript
// 第 100-105 行
async function verifyAndRegister(code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) {  // 仅校验格式，不校验内容
      error.value = '请输入6位验证码'
      return false
    }
    // 直接注册新用户...
}
```

**风险：** 任何人知道手机号即可注册新账号，无需接收真实验证码。结合 S2.1 的 RLS 绕过漏洞，可批量创建账号并访问系统。

**修复建议：**
1. 接入真实 SMS 短信服务（如阿里云、腾讯云短信）
2. 在 Supabase 创建 `cleannote_verify_codes` 表，存储验证码 + 过期时间 + 发送频率限制
3. 服务端验证验证码后才允许注册

---

#### S1.2 Session 伪造测试

| 项目 | 详情 |
|------|------|
| **严重度** | 🟠 高危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/services/auth.ts` 第 23-48 行 |

**发现：**

Session 以 JSON 格式存储在 `localStorage` key `cleannote_session` 中，包含 `userId`、`phone`、`nickname`、`expiresAt` 字段。路由守卫（`src/router/index.ts` 第 133 行）仅检查 `auth.isAuthenticated`，而 `isAuthenticated` 直接读取 localStorage Session：

```typescript
// auth.ts 第 23-36 行
export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const session: Session = JSON.parse(raw)
  if (Date.now() > session.expiresAt) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  return session  // 无服务端校验
}
```

**风险：** 攻击者可在浏览器控制台直接写入伪造的 Session：
```javascript
localStorage.setItem('cleannote_session', 
  JSON.stringify({userId: "目标用户ID", phone: "13800000000", 
   nickname: "admin", loginAt: Date.now(), expiresAt: Date.now()+604800000}))
```
刷新页面后即以目标用户身份登录，无需密码。

**修复建议：**
1. 升级为 Supabase Auth（JWT token + HttpOnly cookie）
2. 每次 API 请求由服务端验证 JWT 签名，而非信任客户端传递的 userId

---

#### S1.3 暴力破解测试

| 项目 | 详情 |
|------|------|
| **严重度** | 🟠 高危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/stores/auth.ts` 第 139-204 行 |

**发现：**

`submitPassword()` 函数无任何前端节流/限速机制。每次调用直接发起 Supabase REST API 请求。后端依赖 Supabase 默认限速（未确认是否启用）。

密码校验在客户端完成（第 188 行 `verifyPassword`），攻击者可通过以下方式绕过：
1. 直接调用 `findUserByPhoneWithCredentials()` API 获取 password_hash + password_salt
2. 离线暴力破解 PBKDF2 哈希（虽然 210,000 次迭代增加了难度，但弱密码仍可被破解）

**风险：** 结合 S1.4 的哈希泄露，可进行离线字典攻击。

**修复建议：**
1. 前端添加登录失败计数器，5 次失败后锁定 15 分钟
2. 密码校验移至服务端（Supabase Edge Function）
3. `findUserByPhoneWithCredentials` 不应通过公开 API 返回 hash/salt

---

#### S1.4 密码哈希传输审计

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/services/auth.ts` 第 111-122 行 |

**发现：**

`findUserByPhoneWithCredentials()` 通过 Supabase REST API（GET 请求）获取用户记录，返回体包含 `password_hash` 和 `password_salt` 字段：

```typescript
// 第 111-122 行
export async function findUserByPhoneWithCredentials(phone: string): Promise<UserCredentials | null> {
  const rows = (await request('cleannote_users', 'GET', {
    query: `?phone=eq.${encodeURIComponent(phone)}&limit=1`,
  })) as Record<string, unknown>[]
  // ...
  return {
    user: rowToUser(r),
    passwordHash: (r.password_hash as string) || null,  // ← 哈希返回到客户端
    passwordSalt: (r.password_salt as string) || null,   // ← 盐返回到客户端
  }
}
```

**风险：** 任何人持有 anon key（见 S4.1）即可通过 GET 请求获取任意手机号用户的密码哈希和盐。虽然 PBKDF2 210,000 次迭代增加了离线破解成本，但对弱密码（如 `12345678`）仍可在合理时间内破解。

**修复建议：**
1. 创建 Supabase Edge Function 处理密码校验，hash/salt 不离开服务端
2. 或在 RLS 策略中排除 `password_hash`/`password_salt` 列的读取权限

---

### S2 — 数据隔离与 RLS 绕过

#### S2.1 x-user-id 伪造攻击

| 项目 | 详情 |
|------|------|
| **严重度** | 🔴 致命 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/services/supabase.ts` 第 8-16 行；`supabase-schema.sql` 第 96-141 行 |

**发现：**

RLS 策略通过 `current_setting('request.headers', true)::json ->> 'x-user-id'` 读取客户端 HTTP 请求头中的 `x-user-id` 字段进行用户过滤。该 header 完全由客户端控制，无服务端验证。

```sql
-- supabase-schema.sql 第 123-125 行
CREATE POLICY "Users can access own tasks" ON cleannote_tasks
  FOR ALL USING (user_id = current_setting('request.headers', true)::json ->> 'x-user-id')
  WITH CHECK (user_id = current_setting('request.headers', true)::json ->> 'x-user-id');
```

Schema 注释（第 99-101 行）明确承认：
> "安全性取决于客户端正确传递 user_id。后续可升级为 Supabase Auth + JWT。"

**攻击 PoC：**
```bash
# 获取用户 A 的所有任务（只需知道其 userId）
curl "https://ghkyhbxltdxhkhpqltdr.supabase.co/rest/v1/cleannote_tasks?user_id=eq.TARGET_USER_ID" \
  -H "apikey: eyJhbGciOiJIUzI1NiIs...（从构建产物提取）" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "x-user-id: TARGET_USER_ID"
```

**风险：** 任何持有 anon key 的人（该 key 在构建产物中公开暴露，见 S4.1）可伪造任意用户的 `x-user-id`，完整读写该用户的全部数据（任务、备忘录、AI 配置、API Key 等）。

**修复建议：**
1. **紧急**：升级为 Supabase Auth，使用 JWT token 替代 x-user-id header
2. 过渡方案：创建 Supabase Edge Function，服务端验证手机号+密码后签发短期 token

---

#### S2.2 跨用户数据访问测试

| 项目 | 详情 |
|------|------|
| **严重度** | 🔴 致命 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | 同 S2.1 |

**发现：**

基于 S2.1 的漏洞，攻击者可：
1. **读取**任意用户的全部数据：任务、回收站、备忘录（含 base64 图片）、AI 对话记录、AI 配置（含第三方 API Key）、周报、成长数据、Todo 列表
2. **写入**恶意数据到任意用户账户
3. **删除**任意用户的数据

其中 `cleannote_ai_config` 表存储用户的第三方 AI API Key（明文），泄露后可直接盗用。

**风险：** 全量数据泄露，包括用户隐私内容和第三方 API 凭证。

**修复建议：** 同 S2.1，必须升级为 Supabase Auth。

---

#### S2.3 Supabase Storage 越权

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/services/supabase.ts` 第 576-578 行 |

**发现：**

`supabaseGetPublicUrl()` 返回的 URL 格式为：
```
https://ghkyhbxltdxhkhpqltdr.supabase.co/storage/v1/object/public/cleannote_attachments/{path}
```

路径模式为 `memo/{userId}/{timestamp}-{filename}`。虽然 userId 是 UUID 难以猜测，但：
1. URL 为 public bucket，任何知道路径的人都可访问
2. RLS 策略依赖 x-user-id header（同 S2.1 漏洞），可伪造 userId 上传/删除他人附件

**修复建议：**
1. 将 bucket 改为 private，通过 signed URL 访问
2. 上传/删除操作需服务端鉴权

---

### S3 — XSS 注入测试

#### S3.1 AppSidebar v-html 注入

| 项目 | 详情 |
|------|------|
| **严重度** | 🟠 高危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/components/AppSidebar.vue` 第 70-72、278 行 |

**发现：**

`showReadme()` 函数通过 `fetch('/readme.txt')` 加载文本，使用 `marked.parse()` 转为 HTML 后直接 `v-html` 渲染，未经过 DOMPurify 净化：

```typescript
// 第 70-72 行
const res = await fetch('/readme.txt')
const md = await res.text()
readmeHtml.value = await marked.parse(md)  // ← 无 sanitize
```

```html
<!-- 第 278 行 -->
<div class="readme-body" v-html="readmeHtml"></div>
```

**风险：** 若 `readme.txt` 被篡改（如通过 IIS 目录覆盖、MITM 攻击），可注入恶意脚本。虽然当前内容由开发者控制，但缺乏纵深防御。

**修复建议：** 在 `marked.parse()` 后添加 `DOMPurify.sanitize()`。

---

#### S3.2 ReportsView v-html 注入

| 项目 | 详情 |
|------|------|
| **严重度** | 🟠 高危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/views/ReportsView.vue` 第 305 行 |

**发现：**

周报 `content` 字段（HTML 富文本）直接通过 `v-html` 渲染，未经净化：

```html
<div class="content-inner" v-html="selectedReport.content"></div>
```

周报 content 在生成时由系统拼接，但如果攻击者通过 S2.1 漏洞向 `cleannote_weekly_reports` 表注入含 `<script>` 标签的 content，用户查看周报时会执行恶意脚本。

**风险：** 结合 S2.1 RLS 绕过，可实现存储型 XSS。

**修复建议：** 渲染前使用 `DOMPurify.sanitize(selectedReport.content)`。

---

#### S3.3 Tiptap 富文本 XSS

| 项目 | 详情 |
|------|------|
| **严重度** | 🟠 高危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/components/RichTextEditor.vue` 第 1148 行 |

**发现：**

1. **LinkExtension** 配置了 `openOnClick: true`，但未设置 `validate` 函数或 `protocols` 白名单。用户可通过 `window.prompt()` 输入 `javascript:alert(1)` 作为链接 URL，点击时执行 JS。

```typescript
// 第 1148 行
LinkExtension.configure({ openOnClick: true, HTMLAttributes: { class: 'rte-link' } }),
```

2. **ImageResize** 允许 `allowBase64: true`，base64 data URI 直接嵌入 HTML content，存储在 localStorage 和 Supabase 中。

3. **FileAttachment** 将整个文件 base64 编码存储在 `data-file` HTML 属性中，无文件类型校验。

**风险：** 攻击者可通过 S2.1 漏洞向用户备忘录注入恶意内容，用户打开备忘录时执行脚本。

**修复建议：**
1. LinkExtension 添加 `validate: (url) => !url.startsWith('javascript:')`
2. 编辑器内容读取时进行 DOMPurify 净化
3. 限制 base64 图片大小（当前 5MB 过大）

---

#### S3.4 Mermaid/Mindmap SVG 注入

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ⚠️ 部分通过 |
| **文件位置** | `src/components/MermaidNodeView.vue` 第 96 行；`src/components/MindmapNodeView.vue` 第 217-218 行 |

**发现：**

- **Mermaid**：配置了 `securityLevel: 'sandbox'`（第 96 行），将渲染输出放入 `<iframe sandbox>` 中，有效阻止脚本执行。✅
- **Mindmap**：使用 `Markmap.create()` 直接操作 SVG DOM（`svgEl.value.innerHTML = ''` 然后 Markmap 渲染），markmap-lib 未提供 securityLevel 配置。如果 Markdown 输入中包含 HTML 标签，markmap 可能将其渲染到 SVG 中。

**风险：** Mindmap 存在潜在 SVG 注入风险，但攻击面较窄（需要用户主动输入恶意 Markdown）。

**修复建议：** Mindmap 渲染前对 Markdown 输入进行净化，或限制允许的 HTML 标签。

---

#### S3.5 DOMPurify 覆盖率审计

| 项目 | 详情 |
|------|------|
| **严重度** | 🟢 低危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | 全局 `v-html` 使用审计 |

**发现：**

全局搜索 `v-html` 共 9 处使用，DOMPurify 覆盖情况：

| # | 文件 | 行号 | 使用场景 | DOMPurify | 风险 |
|---|------|------|---------|-----------|------|
| 1 | H5Layout.vue | 24 | Tab 图标 SVG | ❌ 未净化 | 低（内容固定） |
| 2 | AiChat.vue | 196 | AI 回复 Markdown | ✅ 已净化 | — |
| 3 | AppSidebar.vue | 278 | README 内容 | ❌ 未净化 | 高（见 S3.1） |
| 4 | ConfirmDialog.vue | 76 | 确认弹窗消息 | ❌ 未净化 | 低（程序生成） |
| 5 | ReportsView.vue | 305 | 周报内容 | ❌ 未净化 | 高（见 S3.2） |
| 6 | MermaidNodeView.vue | 349, 422 | Mermaid SVG | ❌ 未净化 | 低（sandbox 隔离） |
| 7 | TaskDetailModal.vue | 195 | 任务描述 Markdown | ✅ 已净化 | — |
| 8 | TaskEditModal.vue | 646 | 任务描述 Markdown | ✅ 已净化 | — |

**额外发现：** `src/stores/memo.ts` 第 12-17 行 `stripHtml()` 函数使用 `div.innerHTML = html` 提取纯文本，虽然不直接渲染到页面，但如果 HTML 包含触发 `onerror` 事件的 `<img>` 标签，在赋值 `innerHTML` 时可能触发资源加载。

**修复建议：** 所有 `v-html` 统一包裹 `DOMPurify.sanitize()`。

---

### S4 — 敏感信息泄露

#### S4.1 anon key 暴露审计

| 项目 | 详情 |
|------|------|
| **严重度** | 🔴 致命 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/services/supabase.ts` 第 5-6 行 |

**发现：**

Supabase URL 和 anon key 硬编码在源码中：

```typescript
export const SUPABASE_URL = 'https://ghkyhbxltdxhkhpqltdr.supabase.co'
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

构建产物确认 key 完整暴露在 `dist/assets/vendor-tiptap-custom-CISHMFxb.js` 中，任何人可从浏览器 DevTools 或部署站点直接提取。

**风险：** 配合 S2.1 的 RLS 绕过漏洞，攻击者拥有完整的数据库访问凭证。

**说明：** Supabase anon key 设计上就是公开的，其安全性完全依赖 RLS 策略。但当前 RLS 策略信任客户端传递的 `x-user-id` header（见 S2.1），导致 anon key 暴露成为致命风险。

**修复建议：** S2.1 修复后（升级为 Supabase Auth），anon key 暴露将不再是安全问题。

---

#### S4.2 /__diag 诊断页暴露

| 项目 | 详情 |
|------|------|
| **严重度** | 🟠 高危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/router/index.ts` 第 56-59 行；`src/views/DiagView.vue` |

**发现：**

`/__diag` 路由标记为 `meta: { public: true }`，无需登录即可访问。该页面遍历 `localStorage` 所有键值对并显示前 300 个字符：

```typescript
// DiagView.vue 第 9-13 行
for (let i = 0; i < localStorage.length; i++) {
  const k = localStorage.key(i)
  const v = localStorage.getItem(k) || ''
  result.push(`${k} = ${v.slice(0, 300)}`)
}
```

**风险：** 泄露所有 localStorage 键名和部分值，包括 `cleannote_session`（含 userId、phone）、各数据前缀模式等。虽然只显示前 300 字符，但足以暴露用户 ID 和手机号。

**修复建议：**
1. 移除 `meta: { public: true }`，要求登录后才能访问
2. 或在生产构建中完全排除 DiagView

---

#### S4.3 构建产物敏感信息扫描

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `dist/assets/vendor-tiptap-custom-CISHMFxb.js` |

**发现：**

对构建产物 `dist/assets/*.js` 进行扫描，发现以下敏感信息：

1. **Supabase URL + anon key**：完整暴露（见 S4.1）
2. **API 请求逻辑**：所有 REST API 路径、表名、请求格式完全可读
3. **Storage bucket 名称**：`cleannote_attachments` 暴露
4. **密码哈希算法**：PBKDF2 迭代次数、盐长度等参数可从代码推断

**修复建议：** 敏感操作移至 Supabase Edge Function（服务端），前端仅持有最小必要信息。

---

### S5 — 文件上传安全

#### S5.1 文件类型绕过测试

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/components/RichTextEditor.vue` 第 1769 行 |

**发现：**

文件附件上传的 `<input>` 元素没有 `accept` 属性限制：

```html
<!-- 第 1768-1769 行 -->
<input ref="imageInputRef" type="file" accept="image/*" class="rte-hidden-input" @change="handleImageUpload" />
<input ref="fileInputRef" type="file" class="rte-hidden-input" @change="handleFileUpload" />
```

`handleFileUpload()` 函数（第 1067 行）仅校验文件大小（5MB），不校验文件类型。用户可上传 `.exe`、`.js`、`.svg`、`.html` 等任何文件类型，以 base64 编码嵌入 HTML content 中。

**风险：** 恶意文件以 base64 嵌入备忘录，下载后在用户机器上执行。虽然文件不经过服务端存储（base64 内嵌），但下载时的 `triggerFileDownload()` 无 MIME 安全检查。

**修复建议：**
1. 添加 `accept` 属性限制文件类型
2. 在 `handleFileUpload()` 中校验 MIME 类型白名单

---

#### S5.2 超大文件 DoS

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/components/RichTextEditor.vue` 第 39-40 行 |

**发现：**

单文件限制 5MB，base64 编码后膨胀约 33%，产生约 6.7MB 字符串。localStorage 典型限制 5-10MB，一张 5MB 图片即可导致 localStorage 溢出。

多个含图片的备忘录场景下，`QuotaExceededError` 会导致：
1. 自动保存失败
2. 脏队列无法持久化
3. 数据可能丢失

**风险：** 用户正常使用（多张图片备忘录）即可触发存储溢出，导致数据丢失。

**修复建议：**
1. 降低单文件限制至 1MB
2. 图片自动压缩（canvas resize）后再 base64 编码
3. 捕获 `QuotaExceededError` 并提示用户

---

#### S5.3 文件名注入测试

| 项目 | 详情 |
|------|------|
| **严重度** | 🟢 低危 |
| **测试结果** | ⚠️ 部分通过 |
| **文件位置** | `src/services/supabase.ts` 第 546 行 |

**发现：**

Supabase Storage 上传时，文件名经过清理：
```typescript
const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
```

但 base64 内嵌方式（RichTextEditor）不清理文件名，直接存入 `data-filename` 属性。若文件名含 `<script>` 等字符，理论上可通过 DOM 解析注入，但 ProseMirror 的 schema 解析会将其视为纯文本属性值，实际风险极低。

---

### S6 — 客户端存储安全

#### S6.1 localStorage 篡改测试

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/services/local.ts`, `src/services/hybrid.ts` |

**发现：**

所有业务数据存储在 localStorage 中，无完整性校验。攻击者可在控制台直接修改：
- 任务状态、优先级
- 备忘录内容
- 成长系统经验值、等级
- AI 配置（API Key）

修改后的数据会在下次同步时覆盖云端数据（`mergeFromCloud` 使用 `updatedAt` 比较，篡改 `updatedAt` 为未来时间即可让本地数据"胜出"）。

**风险：** 用户可篡改成长系统数据（作弊），或通过篡改 `updatedAt` 覆盖云端数据。

**修复建议：** 关键数据（如成长系统）在服务端校验，不信任客户端传入的 XP/等级。

---

#### S6.2 Session 过期绕过

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `src/services/auth.ts` 第 28-30 行 |

**发现：**

Session 过期检查仅在前端：
```typescript
if (Date.now() > session.expiresAt) {
  localStorage.removeItem(SESSION_KEY)
  return null
}
```

攻击者可修改 `expiresAt` 为任意未来时间，永久保持登录状态。后端无 session 失效机制。

**修复建议：** 升级为 Supabase Auth 后，JWT 自带过期时间且签名不可篡改。

---

### S7 — 供应链与依赖安全

#### S7.1 npm 依赖漏洞扫描

| 项目 | 详情 |
|------|------|
| **严重度** | 🟡 中危 |
| **测试结果** | ❌ 未通过 |
| **命令** | `npm audit` |

**发现：**

```
dompurify  <=3.4.10
Severity: moderate
DOMPurify: Permanent ALLOWED_ATTR pollution via setConfig() bypassing the hook 
clone-guard (incomplete fix of the 3.4.7 hook-pollution patch)
- https://github.com/advisories/GHSA-cmwh-pvxp-8882
```

1 个中危漏洞：DOMPurify <=3.4.10 存在 `ALLOWED_ATTR` 污染漏洞。当前项目使用的 DOMPurify 版本存在该漏洞，可能允许攻击者通过 `setConfig()` 绕过属性过滤。

**修复建议：** 运行 `npm audit fix` 升级 DOMPurify 至 3.4.11+。

---

#### S7.2 CSP 缺失审计

| 项目 | 详情 |
|------|------|
| **严重度** | 🟢 低危 |
| **测试结果** | ❌ 未通过 |
| **文件位置** | `index.html` |

**发现：**

`index.html` 中无 `<meta http-equiv="Content-Security-Policy">` 标签，IIS 部署也未见 CSP header 配置。完全缺失 CSP 意味着：
1. 浏览器不限制脚本来源
2. 内联脚本、eval 均可执行
3. XSS 攻击不受额外限制

**修复建议：** 在 `index.html` 中添加 CSP meta 标签：
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: blob:; connect-src 'self' https://ghkyhbxltdxhkhpqltdr.supabase.co;">
```

---

## 三、风险优先级排序

### P0 — 致命漏洞（需立即修复）

| # | 漏洞 | 影响 | 修复难度 |
|---|------|------|---------|
| 1 | **S2.1 + S4.1：x-user-id 伪造 + anon key 暴露** | 任意用户全量数据泄露 | 高（需升级 Supabase Auth） |
| 2 | **S2.2：跨用户数据访问** | 同上 | 同上 |
| 3 | **S1.1：验证码绕过** | 任意手机号注册 | 中（需接入 SMS） |
| 4 | **S4.1 → S2.1 链式攻击** | anon key → 伪造 userId → 全量数据 | 同 S2.1 |

### P1 — 高危漏洞（需尽快修复）

| # | 漏洞 | 影响 | 修复难度 |
|---|------|------|---------|
| 5 | **S1.2：Session 伪造** | 绕过认证 | 高（需 Supabase Auth） |
| 6 | **S1.3：暴力破解** | 账号接管 | 低（前端限速） |
| 7 | **S3.1：AppSidebar v-html 未净化** | XSS | 低（加 DOMPurify） |
| 8 | **S3.2：ReportsView v-html 未净化** | 存储型 XSS | 低（加 DOMPurify） |
| 9 | **S3.3：Tiptap LinkExtension 无 URL 校验** | XSS | 低（加 validate） |
| 10 | **S4.2：/__diag 公开暴露** | 信息泄露 | 低（改为需认证） |

### P2 — 中危漏洞

| # | 漏洞 | 影响 | 修复难度 |
|---|------|------|---------|
| 11 | S1.4：密码哈希传输 | 离线破解 | 中（Edge Function） |
| 12 | S2.3：Storage 公开 URL | 附件泄露 | 中（改 signed URL） |
| 13 | S3.4：Mindmap SVG 注入 | 潜在 XSS | 低（净化输入） |
| 14 | S5.1：文件类型无限制 | 恶意文件上传 | 低（加 accept） |
| 15 | S5.2：大文件 DoS | localStorage 溢出 | 中（压缩+限制） |
| 16 | S6.1：localStorage 篡改 | 数据完整性 | 高（服务端校验） |
| 17 | S6.2：Session 过期绕过 | 永久登录 | 高（需 Supabase Auth） |
| 18 | S4.3：构建产物信息泄露 | 攻击面暴露 | 中（Edge Function） |
| 19 | S7.1：DOMPurify 漏洞 | sanitize 绕过 | 低（npm audit fix） |

### P3 — 低危漏洞

| # | 漏洞 | 影响 | 修复难度 |
|---|------|------|---------|
| 20 | S3.5：stripHtml innerHTML | 潜在资源加载 | 低（用 textContent） |
| 21 | S5.3：文件名注入 | 极低 | 低（清理文件名） |
| 22 | S7.2：CSP 缺失 | 无纵深防御 | 低（加 meta 标签） |

---

## 四、总结与建议

### 核心问题

CleanNotes 当前安全架构的根本缺陷在于：**用户身份认证完全依赖客户端传递的 `x-user-id` HTTP 请求头，而非服务端验证的 JWT token**。这一设计使得系统的所有 RLS 策略形同虚设——任何持有公开 anon key 的人都可以伪造任意用户身份，完整读写其全部数据。

### 修复路线图

**第一阶段（紧急，1-2 周）：**
1. 升级为 Supabase Auth，用 JWT 替代 x-user-id header
2. 所有 RLS 策略改为基于 `auth.uid()` 而非 `request.headers`
3. `findUserByPhoneWithCredentials` 移至 Edge Function，hash/salt 不返回客户端
4. 验证码接入真实 SMS 服务

**第二阶段（重要，1 周）：**
5. 所有 `v-html` 添加 DOMPurify 净化
6. LinkExtension 添加 URL 协议校验
7. /__diag 路由改为需认证
8. `npm audit fix` 升级 DOMPurify
9. 添加 CSP

**第三阶段（改进，2-4 周）：**
10. 文件上传类型限制 + 图片压缩
11. Storage bucket 改为 private + signed URL
12. 前端登录限速
13. 成长系统服务端校验

---

*报告结束*
