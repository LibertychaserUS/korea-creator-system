<template>
  <canvas ref="el" class="abyss-field" :style="{ opacity }" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * AbyssField —— 深海驾驶舱粒子画布（营销站 ABYSS 版专属，Canvas 2D）。
 *
 * 三层构成：
 *  1. 海洋雪：80–120 个微光点缓慢上浮 + 正弦横漂，离屏回收复用；
 *  2. 三条正弦潮线横贯底部，相位随时间漂移；
 *  3. 指针对粒子施加轻微斥力（120px 半径内高斯衰减，逐帧 lerp 平滑）。
 *
 * prefers-reduced-motion：只渲染静态一帧，不启动 rAF；
 * 滚出视口 / 标签页隐藏时暂停；移动端（<768px）粒子减半。
 */
interface Props {
  /** 形态种子：不同 seed 生成不同的粒子分布与潮线相位。 */
  seed?: number
  /** 画布整体不透明度。 */
  opacity?: number
}

const props = withDefaults(defineProps<Props>(), {
  seed: 1,
  opacity: 1,
})

const el = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null
onBeforeUnmount(() => cleanup?.())

/** mulberry32：seed 决定的可复现伪随机。 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Flake {
  x: number
  y: number
  r: number
  vy: number // 上浮速度 px/s
  driftPhase: number
  driftAmp: number
  alpha: number
  twinkle: number
  pushX: number // 指针斥力的平滑值
  pushY: number
}

interface TideLine {
  base: number // 0..1 纵向锚点（底部区域）
  phase: number
  amp: number
  freq: number
  speed: number
  alpha: number
}

onMounted(() => {
  const canvas = el.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mobile = window.matchMedia('(max-width: 767px)').matches
  const rand = rng(props.seed * 7919 + 31)
  let raf = 0
  let onScreen = true
  let w = 0
  let h = 0

  // 海洋雪：桌面 80–120，移动端减半（40–60）。
  const TARGET_MIN = mobile ? 40 : 80
  const TARGET_MAX = mobile ? 60 : 120
  const count = TARGET_MIN + Math.floor(rand() * (TARGET_MAX - TARGET_MIN + 1))
  const flakes: Flake[] = []
  const spawn = (anywhere: boolean): Flake => ({
    x: rand() * Math.max(w, 1),
    y: anywhere ? rand() * Math.max(h, 1) : h + 4,
    r: 0.6 + rand() * 1.2,
    vy: 6 + rand() * 12,
    driftPhase: rand() * Math.PI * 2,
    driftAmp: 4 + rand() * 10,
    alpha: 0.14 + rand() * 0.34,
    twinkle: 0.6 + rand() * 2.2,
    pushX: 0,
    pushY: 0,
  })
  for (let i = 0; i < count; i += 1) flakes.push(spawn(true))

  // 三条潮线：底部 1/3 区域，相位错开。
  const lines: TideLine[] = [0, 1, 2].map((i) => ({
    base: 0.72 + i * 0.09 + rand() * 0.02,
    phase: rand() * Math.PI * 2,
    amp: 10 + rand() * 14,
    freq: 0.0038 + rand() * 0.0016,
    speed: 0.28 + rand() * 0.18,
    alpha: 0.16 - i * 0.04,
  }))

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // 指针斥力：记录目标与平滑值，逐帧 lerp。
  const pointer = { tx: -9999, ty: 0, x: -9999, y: 0, active: false }
  const REPULSE_R = 120
  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    if (event.clientY < rect.top - REPULSE_R || event.clientY > rect.bottom + REPULSE_R) {
      pointer.active = false
      pointer.tx = -9999
      return
    }
    pointer.active = true
    pointer.tx = event.clientX - rect.left
    pointer.ty = event.clientY - rect.top
  }
  const onPointerLeave = () => {
    pointer.active = false
    pointer.tx = -9999
  }
  if (!reduceMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerout', onPointerLeave, { passive: true })
  }

  const SNOW = '230, 237, 243'
  const SONAR = '57, 208, 216'

  const draw = (t: number) => {
    ctx.clearRect(0, 0, w, h)
    pointer.x += (pointer.tx - pointer.x) * 0.08
    pointer.y += (pointer.ty - pointer.y) * 0.08

    // 海洋雪
    for (const f of flakes) {
      const drift = Math.sin(t * 0.5 + f.driftPhase) * f.driftAmp
      let px = f.x + drift + f.pushX
      let py = f.y + f.pushY
      // 指针斥力：径向高斯衰减，lerp 平滑。
      if (pointer.x > -999) {
        const dx = px - pointer.x
        const dy = py - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < REPULSE_R && dist > 0.01) {
          const force = Math.exp(-(dist * dist) / (2 * 56 * 56)) * 22
          f.pushX += ((dx / dist) * force - f.pushX) * 0.1
          f.pushY += ((dy / dist) * force - f.pushY) * 0.1
        } else {
          f.pushX += (0 - f.pushX) * 0.06
          f.pushY += (0 - f.pushY) * 0.06
        }
        px = f.x + drift + f.pushX
        py = f.y + f.pushY
      }
      const tw = 0.75 + Math.sin(t * f.twinkle + f.driftPhase) * 0.25
      ctx.fillStyle = `rgba(${SNOW}, ${(f.alpha * tw).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(px, py, f.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // 潮线
    const step = 12
    for (const line of lines) {
      ctx.strokeStyle = `rgba(${SONAR}, ${line.alpha.toFixed(3)})`
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = -step; x <= w + step; x += step) {
        const y =
          line.base * h +
          Math.sin(x * line.freq + t * line.speed + line.phase) * line.amp +
          Math.sin(x * line.freq * 0.4 + t * line.speed * 0.6 + line.phase * 1.9) * line.amp * 0.5
        if (x <= 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  const active = () => onScreen && document.visibilityState !== 'hidden'

  let last = 0
  const frame = (now: number) => {
    raf = 0
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
    last = now
    const t = now / 1000
    // 粒子推进（离屏回收）
    for (const f of flakes) {
      f.y -= f.vy * dt
      if (f.y < -6) {
        f.y = h + 6
        f.x = rand() * Math.max(w, 1)
      }
    }
    draw(t)
    if (active()) raf = requestAnimationFrame(frame)
  }

  const resume = () => {
    if (reduceMotion || !active() || raf) return
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  let observer: IntersectionObserver | null = null
  if (reduceMotion) {
    draw(0) // 静态一帧
  } else {
    resume()
    observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting)
      if (onScreen) resume()
      else stop()
    })
    observer.observe(canvas)
    document.addEventListener('visibilitychange', resume)
  }

  cleanup = () => {
    stop()
    observer?.disconnect()
    ro.disconnect()
    document.removeEventListener('visibilitychange', resume)
    if (!reduceMotion) {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerout', onPointerLeave)
    }
  }
})
</script>

<style scoped>
.abyss-field {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
