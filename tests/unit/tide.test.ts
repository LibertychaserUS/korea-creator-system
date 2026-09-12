/**
 * 潮汐数学 —— 登录页潮涌/涟漪的纯函数层。
 * 纹样移植自 oliver-zhang：vaporFog.ts 的雾潮呼吸（互质长周期正弦加权和 +
 * smoothstep 整形）与 Cursor.tsx 的涟漪缓动（ease-out 双环）。
 */
import { describe, expect, test } from 'vitest'
import { fogTide, rippleProgress, TIDE_PERIODS } from '@libs/panel/utils/tide'

describe('fogTide', () => {
  test('uses three coprime long periods (61/83/107s)', () => {
    expect(TIDE_PERIODS).toEqual([61, 83, 107])
  })

  test('is deterministic (pure function of t)', () => {
    expect(fogTide(42.5)).toBe(fogTide(42.5))
    expect(fogTide(0)).toBe(fogTide(0))
  })

  test('stays within 0..1 across a dense sweep', () => {
    for (let t = 0; t < 1200; t += 0.37) {
      const v = fogTide(t)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  test('breathes — actually reaches both surge and retreat', () => {
    let min = 1
    let max = 0
    for (let t = 0; t < 1200; t += 0.5) {
      const v = fogTide(t)
      if (v < min) min = v
      if (v > max) max = v
    }
    expect(min).toBeLessThan(0.25)
    expect(max).toBeGreaterThan(0.75)
  })

  test('is continuous (no frame jumps)', () => {
    for (let t = 0; t < 600; t += 3.1) {
      expect(Math.abs(fogTide(t + 0.05) - fogTide(t))).toBeLessThan(0.02)
    }
  })

  test('is not trivially periodic with any single component period', () => {
    for (const p of TIDE_PERIODS) {
      let identical = true
      for (let t = 0; t < 240; t += 13.7) {
        if (Math.abs(fogTide(t + p) - fogTide(t)) > 1e-9) {
          identical = false
          break
        }
      }
      expect(identical).toBe(false)
    }
  })
})

describe('rippleProgress', () => {
  test('dead outside [0, 1)', () => {
    expect(rippleProgress(-0.01)).toBeNull()
    expect(rippleProgress(1)).toBeNull()
    expect(rippleProgress(1.2)).toBeNull()
  })

  test('starts as a small bright outer ring', () => {
    const r = rippleProgress(0)
    expect(r).not.toBeNull()
    expect(r!.outerRadius).toBeCloseTo(6, 5)
    expect(r!.outerAlpha).toBeCloseTo(0.55, 5)
    expect(r!.inner).toBeNull()
  })

  test('outer ring expands and fades with ease-out', () => {
    const a = rippleProgress(0.2)!
    const b = rippleProgress(0.6)!
    expect(b.outerRadius).toBeGreaterThan(a.outerRadius)
    expect(b.outerAlpha).toBeLessThan(a.outerAlpha)
    // ease-out: early growth faster than late growth
    const early = rippleProgress(0.25)!.outerRadius - rippleProgress(0)!.outerRadius
    const late = rippleProgress(1 - 1e-6)!.outerRadius - rippleProgress(0.75)!.outerRadius
    expect(early).toBeGreaterThan(late)
  })

  test('inner ring appears only after the ripple opens (k > 0.15)', () => {
    expect(rippleProgress(0.1)!.inner).toBeNull()
    const r = rippleProgress(0.5)!
    expect(r.inner).not.toBeNull()
    expect(r.inner!.radius).toBeLessThan(r.outerRadius)
    expect(r.inner!.alpha).toBeLessThan(r.outerAlpha)
  })

  test('ends fully faded near max radius', () => {
    const r = rippleProgress(1 - 1e-6)!
    expect(r.outerAlpha).toBeLessThan(0.001)
    expect(r.outerRadius).toBeCloseTo(52, 0)
  })
})
