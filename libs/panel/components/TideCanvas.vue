<template>
  <canvas ref="el" class="tide-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * TideCanvas —— 暖色潮涌画布：雾潮呼吸（fogTide）+ 双环涟漪（rippleProgress）。
 *
 * - 环境涟漪：每 3.5–6s 在中下潮带自动生成，缓慢扩散（2.4–3.6s）。
 * - 指针涟漪：window pointerdown 捕获（canvas 本身 pointer-events:none，
 *   不挡卡片交互），位置即视口坐标。
 * - 潮光：底部岸线暖光随 fogTide 涨落（0=潮退 1=潮涌）。
 * - prefers-reduced-motion：只画一帧静态潮光，不开 rAF。
 */
import { fogTide, rippleProgress } from '@libs/panel/utils/tide'

interface Ripple {
  x: number
  y: number
  t0: number
  dur: number
  scale: number
}

const MAX_RIPPLES = 8
const AMBIENT_MIN_MS = 3500
const AMBIENT_VAR_MS = 2500

const el = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null
onBeforeUnmount(() => cleanup?.())

function palette() {
  const dark = document.documentElement.classList.contains('dark')
  return dark
    ? {
        outer: (a: number) => `rgba(151, 199, 214, ${a.toFixed(3)})`,
        inner: (a: number) => `rgba(224, 176, 116, ${a.toFixed(3)})`,
        shoreTop: `rgba(224, 176, 116, 0)`,
        shoreMid: (a: number) => `rgba(224, 176, 116, ${a.toFixed(3)})`,
        shoreSea: (a: number) => `rgba(72, 116, 138, ${a.toFixed(3)})`,
      }
    : {
        outer: (a: number) => `rgba(31, 82, 99, ${a.toFixed(3)})`,
        inner: (a: number) => `rgba(191, 128, 70, ${a.toFixed(3)})`,
        shoreTop: `rgba(214, 158, 94, 0)`,
        shoreMid: (a: number) => `rgba(214, 158, 94, ${a.toFixed(3)})`,
        shoreSea: (a: number) => `rgba(63, 110, 128, ${a.toFixed(3)})`,
      }
}

onMounted(() => {
  const canvas = el.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ripples: Ripple[] = []
  let raf = 0
  let ambientTimer = 0
  let w = 0
  let h = 0

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const spawn = (x: number, y: number, dur: number, scale: number) => {
    ripples.push({ x, y, t0: performance.now(), dur, scale })
    if (ripples.length > MAX_RIPPLES) ripples.shift()
  }

  const spawnAmbient = () => {
    // 潮带：横向 15%–85%，纵向 35%–88%（岸线附近）
    spawn(
      w * (0.15 + Math.random() * 0.7),
      h * (0.35 + Math.random() * 0.53),
      2400 + Math.random() * 1200,
      1.6 + Math.random() * 1.0,
    )
    ambientTimer = window.setTimeout(spawnAmbient, AMBIENT_MIN_MS + Math.random() * AMBIENT_VAR_MS)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (reduceMotion) return
    const rect = canvas.getBoundingClientRect()
    spawn(event.clientX - rect.left, event.clientY - rect.top, 900, 1)
  }

  const drawShore = (phase: number, colors: ReturnType<typeof palette>) => {
    // 岸线暖光：高度与不透明度随潮相位涨落（潮涌时光带上移、更亮）
    const band = h * (0.22 + phase * 0.16)
    const y0 = h - band
    const grad = ctx.createLinearGradient(0, y0, 0, h)
    grad.addColorStop(0, colors.shoreTop)
    grad.addColorStop(0.55, colors.shoreMid(0.1 + phase * 0.14))
    grad.addColorStop(1, colors.shoreSea(0.12 + phase * 0.16))
    ctx.fillStyle = grad
    ctx.fillRect(0, y0, w, band)
  }

  const draw = (now: number) => {
    ctx.clearRect(0, 0, w, h)
    const colors = palette()
    drawShore(fogTide(now / 1000), colors)
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i]
      const frame = rippleProgress((now - r.t0) / r.dur)
      if (!frame) {
        ripples.splice(i, 1)
        continue
      }
      ctx.strokeStyle = colors.outer(frame.outerAlpha)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(r.x, r.y, frame.outerRadius * r.scale, 0, Math.PI * 2)
      ctx.stroke()
      if (frame.inner) {
        ctx.strokeStyle = colors.inner(frame.inner.alpha)
        ctx.beginPath()
        ctx.arc(r.x, r.y, frame.inner.radius * r.scale, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  if (reduceMotion) {
    // 静态潮光一帧，不启动循环、不生成涟漪
    drawShore(0.5, palette())
  } else {
    const tick = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    ambientTimer = window.setTimeout(spawnAmbient, 1200)
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
  }

  cleanup = () => {
    cancelAnimationFrame(raf)
    clearTimeout(ambientTimer)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointerdown', onPointerDown)
  }
})
</script>

<style scoped>
.tide-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
