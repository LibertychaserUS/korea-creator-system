/**
 * 潮汐数学 —— 听潮登录/宣传页的纯函数动画核。
 *
 * - `fogTide`：三个互质长周期（61/83/107s）正弦加权和，
 *   不可通约 ⇒ 拍频永不精确重复；smoothstep 整形让潮涌/潮退两端驻留。
 * - `rippleProgress`：ease-out 双环涟漪，外环 6→52px，
 *   k>0.15 后内环跟进，透明度随 k 线性消退。
 *
 * 纯函数、零状态、零分配——QA 可复现，帧内可直调。
 */

const TAU = Math.PI * 2

/** 互质长周期（秒）：拍频永不精确重复，是「低频噪声」的确定性替代。 */
export const TIDE_PERIODS = [61, 83, 107] as const

/**
 * 雾潮相位：t 秒 → 0..1（0=潮退，画面舒展；1=潮涌，暖意收拢）。
 * 加权和区间 [-2.2, 2.2] 归一到 0..1，再 smoothstep 整形。
 */
export function fogTide(t: number): number {
  const s =
    Math.sin((t * TAU) / TIDE_PERIODS[0]) +
    0.7 * Math.sin((t * TAU) / TIDE_PERIODS[1] + 1.7) +
    0.5 * Math.sin((t * TAU) / TIDE_PERIODS[2] + 4.2)
  const n = (s + 2.2) / 4.4
  return n * n * (3 - 2 * n)
}

export interface RippleFrame {
  /** 外环半径 px（ease-out 扩张 6 → 52） */
  outerRadius: number
  /** 外环不透明度 0.55 → 0 */
  outerAlpha: number
  /** 内环（k > 0.15 后出现），始终小于外环、更淡 */
  inner: { radius: number; alpha: number } | null
}

/**
 * 涟漪帧：k ∈ [0, 1) → 双环状态；k 越界 → null（涟漪已死，可回收）。
 * ease = 1-(1-k)²（ease-out quad）。
 */
export function rippleProgress(k: number): RippleFrame | null {
  if (k < 0 || k >= 1) return null
  const ease = 1 - (1 - k) * (1 - k)
  return {
    outerRadius: 6 + ease * 46,
    outerAlpha: (1 - k) * 0.55,
    inner: k > 0.15 ? { radius: 2 + ease * 22, alpha: (1 - k) * 0.3 } : null,
  }
}
