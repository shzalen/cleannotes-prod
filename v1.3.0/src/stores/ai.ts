import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AiMessage, AiConfig, AiPendingAction } from '@/types'
import { useTaskStore } from '@/stores/task'
import { getStorage } from '@/services/storage'
import { toUTCISO, toLocalDate } from '@/utils/time'
import { encryptString, decryptString } from '@/utils/crypto'
import { getCurrentUserIdSync } from '@/services/supabaseClient'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Tool definitions for Function Calling */
const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'create_task',
      description: '创建一个新任务。用户提到添加/新建/创建任务时使用此工具。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: '优先级，默认medium' },
          dueDate: { type: 'string', description: '截止日期，格式 YYYY-MM-DD，可选' },
          startTime: { type: 'string', description: '时间节点（开始时间），格式 HH:mm，可选；设置后任务会在首页时间线中显示' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签列表，可选' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_tasks',
      description: '查询任务列表。用户询问任务情况、统计、概览时使用此工具。',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['today', 'overdue', 'all', 'todo', 'in_progress', 'done'],
            description: '筛选条件：today=今日任务，overdue=已逾期，all=全部，todo=待办，in_progress=进行中，done=已完成',
          },
        },
        required: ['filter'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_task',
      description: '修改任务属性（状态、优先级、截止日期等）。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务ID' },
          title: { type: 'string', description: '新标题，可选' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: '新状态，可选' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: '新优先级，可选' },
          dueDate: { type: 'string', description: '新截止日期 YYYY-MM-DD，可选，传null清除' },
          startTime: { type: 'string', description: '新时间节点，格式 HH:mm，可选，传null清除；设置后任务在首页时间线中显示' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_task',
      description: '删除一个任务（移入回收站）。需要用户确认后执行。已完成任务不可删除。',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务ID' },
        },
        required: ['taskId'],
      },
    },
  },
]

/** Tools that require user confirmation before execution */
const CONFIRM_REQUIRED_TOOLS = new Set(['update_task', 'delete_task'])

export const useAiStore = defineStore('ai', () => {
  const messages = ref<AiMessage[]>([])
  const config = ref<AiConfig>({ apiUrl: '', apiKey: '', model: '' })
  const loading = ref(false)
  const loaded = ref(false)
  /** Extra context to inject (e.g. from "AI分析" on a specific task) */
  const extraContext = ref('')

  async function load() {
    if (loaded.value) return
    const storage = getStorage()
    messages.value = await storage.getAiMessages()
    const saved = await storage.getAiConfig()
    if (saved) {
      // S-05: Decrypt API key on load
      const userId = getCurrentUserIdSync()
      if (userId && saved.apiKey) {
        saved.apiKey = await decryptString(saved.apiKey, userId)
      }
      config.value = saved
    }
    loaded.value = true
  }

  async function persistMessages() {
    const storage = getStorage()
    await storage.saveAiMessages(messages.value)
  }

  /** 单条 upsert 消息（增量同步） */
  function upsertMessagePersist(msg: AiMessage) {
    const storage = getStorage()
    storage.upsertAiMessage(msg).catch(() => {})
  }

  async function persistConfig() {
    const storage = getStorage()
    // S-05: Encrypt API key before storing
    const userId = getCurrentUserIdSync()
    if (userId && config.value.apiKey) {
      const encryptedKey = await encryptString(config.value.apiKey, userId)
      await storage.saveAiConfig({ ...config.value, apiKey: encryptedKey })
    } else {
      await storage.saveAiConfig(config.value)
    }
  }

  function addUserMessage(content: string) {
    const msg: AiMessage = { id: genId(), role: 'user', content, timestamp: toUTCISO() }
    messages.value.push(msg)
    trimMessages() // P-15: cap at 200 messages
    upsertMessagePersist(msg)
  }

  function addAssistantMessage(content: string, pendingAction?: AiPendingAction) {
    const msg: AiMessage = { id: genId(), role: 'assistant', content, timestamp: toUTCISO() }
    if (pendingAction) msg.pendingAction = pendingAction
    messages.value.push(msg)
    trimMessages() // P-15: cap at 200 messages
    upsertMessagePersist(msg)
  }

  /** P-15: Trim message history to prevent unbounded growth */
  const MAX_AI_MESSAGES = 200
  function trimMessages() {
    if (messages.value.length > MAX_AI_MESSAGES) {
      const removed = messages.value.splice(0, messages.value.length - MAX_AI_MESSAGES)
      const storage = getStorage()
      for (const m of removed) {
        storage.deleteAiMessageById(m.id).catch(() => {})
      }
    }
  }

  function buildChatUrl(input: string): string {
    const url = input.trim()
    if (url.includes('/chat/completions')) return url
    const base = url.replace(/\/+$/, '')
    if (base.endsWith('/v1')) return base + '/chat/completions'
    return base + '/v1/chat/completions'
  }

  // ---- P0: Task context awareness ----

  function buildSystemPrompt(): string {
    const taskStore = useTaskStore()
    const now = new Date()
    const today = toLocalDate(now)
    const allTasks = taskStore.tasks

    const todoTasks = allTasks.filter(t => t.status === 'todo')
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress')
    const doneToday = allTasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt.startsWith(today))
    const overdueTasks = allTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < today)

    const lines = [
      '你是「清记」App 的任务管理助手。你可以查看、创建、修改和删除任务。',
      '修改和删除任务需要用户确认后才能执行。',
      '',
      `当前日期：${today}`,
      '',
      '## 用户任务概况',
      `- 待办任务：${todoTasks.length} 项`,
      `- 进行中：${inProgressTasks.length} 项`,
      `- 今日已完成：${doneToday.length} 项`,
      `- 已逾期：${overdueTasks.length} 项`,
    ]

    if (overdueTasks.length > 0) {
      lines.push('', '### 已逾期任务')
      for (const t of overdueTasks.slice(0, 5)) {
        lines.push(`- ${t.title}（截止 ${t.dueDate}，${t.status === 'todo' ? '待办' : '进行中'}）`)
      }
      if (overdueTasks.length > 5) lines.push(`- ...共 ${overdueTasks.length} 项`)
    }

    if (todoTasks.length > 0 || inProgressTasks.length > 0) {
      lines.push('', '### 当前待办 & 进行中')
      const active = [...inProgressTasks, ...todoTasks].slice(0, 10)
      for (const t of active) {
        const statusLabel = t.status === 'in_progress' ? '进行中' : '待办'
        const priorityLabel = t.priority === 'high' ? '🔴高' : t.priority === 'low' ? '🟢低' : '🟡中'
        const due = t.dueDate ? `，截止${t.dueDate}` : ''
        const start = t.startTime ? `，时间节点${t.startTime}` : ''
        lines.push(`- ${t.title}（${statusLabel}，${priorityLabel}${due}${start}）`)
      }
      const remaining = todoTasks.length + inProgressTasks.length - active.length
      if (remaining > 0) lines.push(`- ...共 ${remaining} 项未显示`)
    }

    if (extraContext.value) {
      lines.push('', '## 额外上下文', extraContext.value)
    }

    return lines.join('\n')
  }

  // ---- P1: Function Calling execution ----

  function executeToolCall(name: string, args: Record<string, any>): string {
    const taskStore = useTaskStore()

    switch (name) {
      case 'create_task': {
        const task = taskStore.addTask({
          title: args.title,
          priority: args.priority,
          dueDate: args.dueDate || null,
          startTime: args.startTime || null,
          tags: args.tags,
        })
        return `✅ 已创建任务「${task.title}」${task.dueDate ? `，截止 ${task.dueDate}` : ''}`
      }
      case 'list_tasks': {
        const now = toLocalDate()
        let tasks = taskStore.tasks
        let label = ''
        switch (args.filter) {
          case 'today':
            tasks = tasks.filter(t => t.createdAt.startsWith(now) || (t.completedAt && t.completedAt.startsWith(now)))
            label = '今日任务'
            break
          case 'overdue':
            tasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < now)
            label = '已逾期任务'
            break
          case 'todo':
            tasks = tasks.filter(t => t.status === 'todo')
            label = '待办任务'
            break
          case 'in_progress':
            tasks = tasks.filter(t => t.status === 'in_progress')
            label = '进行中任务'
            break
          case 'done':
            tasks = tasks.filter(t => t.status === 'done')
            label = '已完成任务'
            break
          default:
            label = '全部任务'
        }
        if (tasks.length === 0) return `${label}：暂无任务。`
        const lines = [`${label}（共 ${tasks.length} 项）：`]
        for (const t of tasks.slice(0, 15)) {
          const statusLabel = t.status === 'in_progress' ? '⏳' : t.status === 'done' ? '✅' : '⬜'
          const due = t.dueDate ? `截止${t.dueDate} ` : ''
          const start = t.startTime ? `时间节点${t.startTime} ` : ''
          lines.push(`- ${statusLabel} ${t.title}（${due}${start}优先级：${t.priority}）`)
        }
        if (tasks.length > 15) lines.push(`...共 ${tasks.length} 项，仅显示前 15 项`)
        return lines.join('\n')
      }
      case 'update_task': {
        const task = taskStore.tasks.find(t => t.id.startsWith(args.taskId) || t.id === args.taskId)
        if (!task) return `❌ 未找到任务（ID: ${args.taskId}）`
        const patch: Record<string, any> = {}
        if (args.title) patch.title = args.title
        if (args.status) patch.status = args.status
        if (args.priority) patch.priority = args.priority
        if (args.dueDate !== undefined) patch.dueDate = args.dueDate || null
        if (args.startTime !== undefined) patch.startTime = args.startTime || null
        taskStore.updateTask(task.id, patch)
        return `✅ 已更新任务「${task.title}」`
      }
      case 'delete_task': {
        const task = taskStore.tasks.find(t => t.id.startsWith(args.taskId) || t.id === args.taskId)
        if (!task) return `❌ 未找到任务（ID: ${args.taskId}）`
        if (task.status === 'done') return `❌ 已完成的任务不允许删除`
        const title = task.title
        taskStore.deleteTask(task.id)
        return `✅ 已删除任务「${title}」（已移入回收站）`
      }
      default:
        return `❌ 未知工具：${name}`
    }
  }

  /** Build human-readable description for confirmation */
  function describeAction(name: string, args: Record<string, any>): string {
    const statusMap: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }
    const priorityMap: Record<string, string> = { low: '低', medium: '中', high: '高' }

    switch (name) {
      case 'update_task': {
        const parts: string[] = []
        if (args.status) parts.push(`状态 → ${statusMap[args.status] || args.status}`)
        if (args.priority) parts.push(`优先级 → ${priorityMap[args.priority] || args.priority}`)
        if (args.dueDate !== undefined) parts.push(`截止日期 → ${args.dueDate || '清除'}`)
        if (args.startTime !== undefined) parts.push(`时间节点 → ${args.startTime || '清除'}`)
        if (args.title) parts.push(`标题 → ${args.title}`)
        return `修改任务 [${args.taskId.slice(0, 8)}]：${parts.join('，')}`
      }
      case 'delete_task':
        return `删除任务 [${args.taskId.slice(0, 8)}]（移入回收站）`
      default:
        return `${name}(${JSON.stringify(args)})`
    }
  }

  // ---- Handle tool calls from model response ----
  // Supports both flat format { id, name, arguments } (from streaming accumulator)
  // and nested format { id, function: { name, arguments } } (from non-streaming response)

  function normalizeToolCall(tc: any): { id: string; name: string; arguments: string } | null {
    try {
      // Flat format (from toolCallMap)
      if (tc.name) {
        return { id: tc.id || '', name: tc.name, arguments: tc.arguments || '{}' }
      }
      // Nested OpenAI format (from non-streaming response)
      if (tc.function?.name) {
        return { id: tc.id || '', name: tc.function.name, arguments: tc.function.arguments || '{}' }
      }
      console.warn('Tool call has no name, skipping:', JSON.stringify(tc).slice(0, 200))
      return null
    } catch (e) {
      console.error('Failed to normalize tool call:', e)
      return null
    }
  }

  async function handleToolCalls(rawToolCalls: any[]): Promise<void> {
    const taskStore = useTaskStore()

    for (const raw of rawToolCalls) {
      const tc = normalizeToolCall(raw)
      if (!tc) continue

      const { name, arguments: argsStr } = tc
      let args: Record<string, any> = {}
      try {
        args = JSON.parse(argsStr)
      } catch {
        addAssistantMessage(`❌ 无法解析工具参数：${argsStr.slice(0, 100)}`)
        continue
      }

      try {
        // If this tool requires confirmation, show confirmation card instead of executing
        if (CONFIRM_REQUIRED_TOOLS.has(name)) {
          // Try to resolve task ID for better display
          const taskId = args.taskId
          if (taskId) {
            const task = taskStore.tasks.find(t => t.id.startsWith(taskId) || t.id === taskId)
            if (task) {
              args.taskId = task.id // normalize to full ID
              // Enrich description with task title
              const title = task.title
              if (name === 'update_task') {
                const statusMap: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }
                const priorityMap: Record<string, string> = { low: '低', medium: '中', high: '高' }
                const parts: string[] = []
                if (args.status) parts.push(`状态 → ${statusMap[args.status] || args.status}`)
                if (args.priority) parts.push(`优先级 → ${priorityMap[args.priority] || args.priority}`)
                if (args.dueDate !== undefined) parts.push(`截止日期 → ${args.dueDate || '清除'}`)
                addAssistantMessage(
                  `📋 **${title}**\n\n${parts.join('，')}\n\n请确认是否执行此操作。`,
                  {
                    toolCallId: tc.id,
                    toolName: name,
                    args,
                    description: `修改「${title}」：${parts.join('，')}`,
                    confirmed: null,
                  }
                )
              } else if (name === 'delete_task') {
                addAssistantMessage(
                  `⚠️ 即将删除任务**「${title}」**（移入回收站）\n\n请确认是否执行此操作。`,
                  {
                    toolCallId: tc.id,
                    toolName: name,
                    args,
                    description: `删除「${title}」`,
                    confirmed: null,
                  }
                )
              }
              continue
            }
          }
          // Fallback if task not found
          addAssistantMessage(
            `📋 ${describeAction(name, args)}\n\n请确认是否执行此操作。`,
            { toolCallId: tc.id, toolName: name, args, description: describeAction(name, args), confirmed: null }
          )
          continue
        }

        // Auto-execute (create_task, list_tasks)
        const result = executeToolCall(name, args)
        addAssistantMessage(result)
      } catch (toolError) {
        console.error(`Error executing tool ${name}:`, toolError)
        addAssistantMessage(`❌ 工具执行出错（${name}）：${toolError instanceof Error ? toolError.message : '未知错误'}`)
      }
    }
  }

  /** User confirms a pending action */
  async function confirmAction(messageId: string): Promise<void> {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg?.pendingAction || msg.pendingAction.confirmed !== null) return

    msg.pendingAction.confirmed = true

    // Execute the tool
    const result = executeToolCall(msg.pendingAction.toolName, msg.pendingAction.args)
    // Append result as a new assistant message
    addAssistantMessage(result)
    // Update the original message to show confirmed
    msg.content = msg.content.replace('请确认是否执行此操作。', '✅ 已确认执行')
    upsertMessagePersist(msg)
  }

  /** User rejects a pending action */
  function rejectAction(messageId: string): void {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg?.pendingAction || msg.pendingAction.confirmed !== null) return

    msg.pendingAction.confirmed = false
    msg.content = msg.content.replace('请确认是否执行此操作。', '❌ 已取消')
    upsertMessagePersist(msg)
  }

  // ---- Main send function with streaming ----

  async function send(content: string) {
    addUserMessage(content)
    loading.value = true

    if (!config.value.apiUrl || !config.value.apiKey) {
      addAssistantMessage('请先在设置中配置 AI API 地址和密钥。')
      loading.value = false
      return
    }

    const apiUrl = buildChatUrl(config.value.apiUrl)

    try {
      // Build messages with system prompt + history
      const systemPrompt = buildSystemPrompt()
      const recentMessages = messages.value
        .slice(-20)
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }))

      const allMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...recentMessages,
      ]

      // 90s timeout for streaming
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90000)

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.value.apiKey}`,
        },
        body: JSON.stringify({
          model: config.value.model || 'gpt-4o-mini',
          messages: allMessages,
          tools: TOOLS,
          tool_choice: 'auto',
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        clearTimeout(timeout)
        let errMsg = `HTTP ${res.status}`
        try {
          const errText = await res.text()
          const errData = JSON.parse(errText)
          errMsg += `: ${errData.error?.message || errData.message || errText.slice(0, 200)}`
        } catch {
          errMsg += `: (无法读取错误详情)`
        }
        throw new Error(errMsg)
      }

      // ---- Prepare streaming state ----
      const decoder = new TextDecoder()
      let buffer = ''   // leftover partial lines
      let fullContent = ''  // accumulated text content
      let finishReason = ''

      // Accumulate tool calls from stream
      const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>()

      // Create a placeholder assistant message for streaming display
      const streamMsg: AiMessage = {
        id: genId(),
        role: 'assistant',
        content: '',
        timestamp: toUTCISO(),
      }
      messages.value.push(streamMsg)

      // ---- Streaming SSE parsing ----
      const reader = res.body?.getReader()
      if (!reader) {
        // No streaming body → try to parse as non-streaming JSON response
        const fullText = await res.text()
        try {
          const jsonResp = JSON.parse(fullText)
          const choice = jsonResp.choices?.[0]
          if (!choice) throw new Error('响应无 choices')

          const message = choice.message
          if (!message) throw new Error('响应无 message')

          // Handle text content
          fullContent = message.content || ''
          streamMsg.content = fullContent || '(无回复)'

          // Handle tool calls from non-streaming response (nested format)
          if (message.tool_calls && message.tool_calls.length > 0) {
            await handleToolCalls(message.tool_calls)
          }

          upsertMessagePersist(streamMsg)
          return
        } catch (parseErr) {
          throw new Error(`无法解析 API 响应（非流式格式）：${parseErr instanceof Error ? parseErr.message : String(parseErr)}`)
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // Keep the last potentially incomplete line in buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === ':') continue  // skip empty / keepalive
            if (trimmed === 'data: [DONE]') {
              finishReason = 'done'
              continue
            }
            if (!trimmed.startsWith('data: ')) continue

            const jsonStr = trimmed.slice(6)
            let chunk: any
            try {
              chunk = JSON.parse(jsonStr)
            } catch {
              // Malformed JSON, skip
              continue
            }

            const delta = chunk.choices?.[0]?.delta
            if (!delta) continue

            // Accumulate text content
            if (delta.content) {
              fullContent += delta.content
              streamMsg.content = fullContent
            }

            // Accumulate tool calls
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCallMap.has(idx)) {
                  toolCallMap.set(idx, {
                    id: tc.id || '',
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  })
                } else {
                  const existing = toolCallMap.get(idx)!
                  if (tc.id) existing.id = tc.id
                  if (tc.function?.name) existing.name = tc.function.name
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments
                }
              }
            }

            // Check finish reason
            const reason = chunk.choices?.[0]?.finish_reason
            if (reason) finishReason = reason
          }
        }
      } finally {
        clearTimeout(timeout)
      }

      // ---- Post-stream processing ----

      // If no SSE data was received (stream might have returned a non-stream JSON)
      if (!fullContent && toolCallMap.size === 0 && finishReason === '') {
        // The entire response might have been a single non-streaming JSON object
        // Try to re-read accumulated buffer
        messages.value = messages.value.filter(m => m.id !== streamMsg.id)
        throw new Error('未收到流式数据。请确认 API 支持流式（stream: true）输出，或尝试关闭流式模式。')
      }

      // If there are tool calls, handle them
      if (toolCallMap.size > 0) {
        const toolCalls = Array.from(toolCallMap.values())
        // If the text content before tool calls is non-empty, keep it
        if (fullContent.trim()) {
          streamMsg.content = fullContent
        } else {
          // Remove the empty placeholder message
          messages.value = messages.value.filter(m => m.id !== streamMsg.id)
        }
        try {
          await handleToolCalls(toolCalls)
        } catch (toolErr) {
          console.error('handleToolCalls error:', toolErr)
          addAssistantMessage(`❌ 工具调用处理失败：${toolErr instanceof Error ? toolErr.message : '未知错误'}`)
        }
      } else {
        // Regular text reply — update the stream message
        streamMsg.content = fullContent || '(无回复)'
      }

      // Persist the final stream message via upsert
      upsertMessagePersist(streamMsg)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      if (msg.includes('404')) {
        addAssistantMessage(
          `请求失败: HTTP 404（接口不存在）\n\n实际请求的地址：${apiUrl}\n\n可能原因：\n1. API 地址填写有误，请检查设置中的「API 地址」\n2. 若只需填写基础地址（如 https://api.openai.com），系统会自动补全路径\n3. 若已填写完整地址，请确认该地址支持 Chat Completions 接口`
        )
      } else if (msg.includes('abort')) {
        addAssistantMessage('请求失败: 请求超时，请稍后重试')
      } else {
        addAssistantMessage(`请求失败: ${msg}`)
      }
    } finally {
      loading.value = false
      // Clear extra context after each send
      extraContext.value = ''
    }
  }

  /** Set extra context for next message (used by P2 quick actions) */
  function setExtraContext(ctx: string) {
    extraContext.value = ctx
  }

  function clearMessages() {
    messages.value = []
    const storage = getStorage()
    storage.deleteAllAiMessages().catch(() => {})
  }

  return {
    messages, config, loading, extraContext,
    load, send, clearMessages, persistConfig,
    confirmAction, rejectAction, setExtraContext,
  }
})
