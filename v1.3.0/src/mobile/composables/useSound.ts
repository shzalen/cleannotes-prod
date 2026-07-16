/**
 * H5 移动端声音工具
 *
 * 设计要点：
 * - AudioContext 单例：避免每次 new + close 导致浏览器安全策略拒绝
 * - 自动 resume：AudioContext 可能因浏览器策略处于 suspended 状态，播放前恢复
 * - 静默降级：不支持 Web Audio 的环境无异常
 */

let audioCtx: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

/**
 * 清脆叮声 — 刷新成功提示
 * 高频泛音快速上滑，轻快短促
 */
export function playDingSound() {
  const ctx = getContext()
  if (!ctx) return

  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = 'sine'
  osc.frequency.setValueAtTime(1760, t)       // A6
  osc.frequency.setValueAtTime(2093, t + 0.04) // C7 快速上滑
  osc.frequency.setValueAtTime(2637, t + 0.06) // E7
  gain.gain.setValueAtTime(0.22, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)

  osc.start(t)
  osc.stop(t + 0.25)
}

/**
 * 厚重叮声 — 进度更新完成提示
 * 低频 + 双泛音，更长的衰减，听感更"重"
 */
export function playProgressSound() {
  const ctx = getContext()
  if (!ctx) return

  const t = ctx.currentTime

  // 低频主音 — 三角波（比正弦波更丰富）
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.connect(gain1)
  gain1.connect(ctx.destination)

  osc1.type = 'triangle'
  osc1.frequency.setValueAtTime(660, t)        // E5
  osc1.frequency.setValueAtTime(880, t + 0.05)  // A5
  gain1.gain.setValueAtTime(0.2, t)
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.5)

  osc1.start(t)
  osc1.stop(t + 0.5)

  // 高频辅音 — 正弦波叠加
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.connect(gain2)
  gain2.connect(ctx.destination)

  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(1320, t)        // E6
  osc2.frequency.setValueAtTime(1760, t + 0.04)  // A6
  gain2.gain.setValueAtTime(0.15, t)
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

  osc2.start(t)
  osc2.stop(t + 0.35)
}
