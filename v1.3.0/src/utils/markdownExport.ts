/**
 * Convert memo HTML content to Markdown.
 * Supports: headings, paragraphs, lists, task lists, blockquote, code blocks,
 * callout, toggle, horizontal rule, links, images, tables, strong/em/strike/code.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body

  return nodesToMarkdown(Array.from(body.childNodes))
}

function nodesToMarkdown(nodes: Node[]): string {
  return nodes.map((n) => nodeToMarkdown(n)).filter(Boolean).join('\n\n')
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  switch (tag) {
    case 'p':
      return inlineToMarkdown(el)
    case 'h1':
      return `# ${inlineToMarkdown(el)}`
    case 'h2':
      return `## ${inlineToMarkdown(el)}`
    case 'h3':
      return `### ${inlineToMarkdown(el)}`
    case 'ul':
      return listToMarkdown(el, '- ')
    case 'ol':
      return listToMarkdown(el, (i) => `${i + 1}. `)
    case 'blockquote':
      return blockquoteToMarkdown(el)
    case 'pre':
      return preToMarkdown(el)
    case 'hr':
      return '---'
    case 'div':
      if (el.classList.contains('rte-callout')) return calloutToMarkdown(el)
      if (el.classList.contains('rte-toggle')) return toggleToMarkdown(el)
      return nodesToMarkdown(Array.from(el.childNodes))
    case 'table':
      return tableToMarkdown(el)
    case 'br':
      return ''
    default:
      return inlineToMarkdown(el)
  }
}

function inlineToMarkdown(el: HTMLElement): string {
  let text = ''
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || ''
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const c = child as HTMLElement
    const tag = c.tagName.toLowerCase()
    const inner = inlineToMarkdown(c)

    switch (tag) {
      case 'strong':
      case 'b':
        text += `**${inner}**`
        break
      case 'em':
      case 'i':
        text += `*${inner}*`
        break
      case 's':
      case 'strike':
      case 'del':
        text += `~~${inner}~~`
        break
      case 'code':
        text += `\`${inner}\``
        break
      case 'a':
        text += `[${inner}](${c.getAttribute('href') || ''})`
        break
      case 'img':
        text += `![${c.getAttribute('alt') || ''}](${c.getAttribute('src') || ''})`
        break
      case 'span':
        if (c.classList.contains('rte-file-link')) {
          text += `[📎 ${c.textContent || 'file'}](${c.getAttribute('data-file') || ''})`
        } else if (c.classList.contains('rte-memo-mention')) {
          text += `[[${c.textContent || ''}]]`
        } else {
          text += inner
        }
        break
      case 'br':
        text += '\n'
        break
      default:
        text += inner
    }
  }
  return text.trim()
}

function listToMarkdown(el: HTMLElement, marker: string | ((i: number) => string)): string {
  const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li')
  return items
    .map((li, i) => {
      const itemEl = li as HTMLElement
      const prefix = typeof marker === 'function' ? marker(i) : marker
      const isTaskList = itemEl.parentElement?.getAttribute('data-type') === 'taskList'

      if (isTaskList) {
        const checkbox = itemEl.querySelector('input[type="checkbox"]') as HTMLInputElement | null
        const checked = checkbox?.checked ? 'x' : ' '
        // Task item content is inside the second child (div)
        const contentDiv = itemEl.querySelector('div') as HTMLElement | null
        const text = contentDiv ? inlineToMarkdown(contentDiv) : inlineToMarkdown(itemEl).replace(/^\[[ x]\]\s*/, '')
        return `${prefix}[${checked}] ${text}`
      }

      return `${prefix}${inlineToMarkdown(itemEl)}`
    })
    .join('\n')
}

function blockquoteToMarkdown(el: HTMLElement): string {
  return inlineToMarkdown(el)
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

function preToMarkdown(el: HTMLElement): string {
  const code = el.querySelector('code')
  const text = code ? code.textContent || '' : el.textContent || ''
  return '```\n' + text.replace(/\n+$/, '') + '\n```'
}

function calloutToMarkdown(el: HTMLElement): string {
  const emoji = el.getAttribute('data-emoji') || '💡'
  const content = el.querySelector('.rte-callout-content') as HTMLElement | null
  const text = content ? inlineToMarkdown(content) : inlineToMarkdown(el).replace(emoji, '').trim()
  return `> ${emoji} ${text}`
}

function toggleToMarkdown(el: HTMLElement): string {
  const summary = el.getAttribute('data-summary') || '点击展开'
  const content = el.querySelector('.rte-toggle-content') as HTMLElement | null
  const text = content ? inlineToMarkdown(content) : inlineToMarkdown(el).replace(summary, '').trim()
  return `<details>\n<summary>${summary}</summary>\n\n${text}\n</details>`
}

function tableToMarkdown(el: HTMLElement): string {
  const rows = Array.from(el.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  const lines = rows.map((row) => {
    const cells = Array.from(row.querySelectorAll('th, td')).map((cell) => inlineToMarkdown(cell as HTMLElement))
    return `| ${cells.join(' | ')} |`
  })

  // Insert separator after header row
  const headerCells = Array.from(rows[0].querySelectorAll('th, td'))
  const separator = `| ${headerCells.map(() => '---').join(' | ')} |`
  lines.splice(1, 0, separator)

  return lines.join('\n')
}

/**
 * Strip HTML tags to plain text (preserves line breaks).
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html.replace(/<\/p>/g, '</p>\n').replace(/<br\s*\/?>/g, '\n')
  return (div.textContent || div.innerText || '').trim()
}
