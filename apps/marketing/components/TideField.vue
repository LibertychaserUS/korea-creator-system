<template>
  <canvas ref="el" class="tide-field" :style="{ opacity }" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * TideField —— 生成式潮汐线画布（营销站专属，Canvas 2D）。
 *
 * 多层正弦波线簇：深色青 / 次级青 / 墨线三组，随时间缓慢漂移、相位错开。
 * 指针靠近时波线对其产生轻微吸引偏移（≤8px，逐帧 lerp 平滑）。
 * prefers-reduced-motion：只渲染静态一帧，不启动 rAF。
 * 滚出视口 / 标签页隐藏时暂停；波线参数全部由 props 控制，各呼吸区用 seed 错开形态。
 */
interface Props {
  /** 形态种子：同一组参数下不同 seed 生成不同相位/疏密。 */
  seed?: number
  /** 基础振幅（px）。 */
  amplitude?: number
  /** 空间频率（每 px 弧度系数，越大波越密）。 */
  frequency?: number
  /** 时间速度（弧度/秒量级，越大漂得越快）。 */
  speed?: number
  /** 画布整体不透明度。 */
  opacity?: number
}

const props = withDefaults(defineProps<Props>(), {
  seed: 1,
  amplitude: 14,
  frequency: 0.0042,
  speed: 0.35,
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

interface WaveLine {
  base: number // 0..1 纵向锚点
  phase: number
  ampScale: number
  freqScale: number
  width: number
  cluster: 0 | 1 | 2
}

onMounted(() => {
  const canvas = el.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const rand = rng(props.seed * 1000 + 17)
  let raf = 0
  let onScreen = true
  let w = 0
  let h = 0

  // 三组线簇：深青（主）、青（次）、墨线；每组 4–6 条，纵向铺开、相位错开。
  const clusters = [
    { color: [9, 55, 83] as const, alpha: 0.34, count: 5 },
    { color: [47, 95, 143] as const, alpha: 0.26, count: 5 },
    { color: [26, 26, 26] as const, alpha: 0.16, count: 3 },
  ]
  const lines: WaveLine[] = []
  clusters.forEach((c, ci) => {
    for (let i = 0; i < c.count; i += 1) {
      lines.push({
        base: 0.16 + rand() * 0.68,
        phase: rand() * Math.PI * 2,
        ampScale: 0.55 + rand() * 0.9,
        freqScale: 0.8 + rand() * 0.5,
        width: ci === 2 ? 1 : 1 + rand() * 0.3,
        cluster: ci as 0 | 1 | 2,
      })
    }
  })
  lines.sort((a, b) => a.base - b.base)

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

  // 指针吸引：记录目标与平滑值，逐帧 lerp。
  const pointer = { tx: -9999, ty: 0, x: -9999, y: 0, active: false }
  const MAX_PULL = 8
  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    if (event.clientY < rect.top - 80 || event.clientY > rect.bottom + 80) {
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

  const dark = () => document.documentElement.classList.contains('dark')
  const clusterColor = (i: 0 | 1 | 2) =>
    dark()
      ? i === 0
        ? ([151, 199, 214] as const)
        : i === 1
          ? ([110, 158, 196] as const)
          : ([214, 210, 200] as const)
      : clusters[i].color

  const draw = (t: number) => {
    ctx.clearRect(0, 0, w, h)
    pointer.x += (pointer.tx - pointer.x) * 0.06
    pointer.y += (pointer.ty - pointer.y) * 0.06

    const step = 10
    for (const line of lines) {
      const c = clusters[line.cluster]
      const [r, g, b] = clusterColor(line.cluster)
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(c.alpha * (line.cluster === 2 ? 0.9 : 1)).toFixed(3)})`
      ctx.lineWidth = line.width
      ctx.beginPath()
      const baseY = line.base * h
      const amp = props.amplitude * line.ampScale
      const freq = props.frequency * line.freqScale
      for (let x = -step; x <= w + step; x += step) {
        const drift = Math.sin(x * freq + t * props.speed + line.phase) * amp
        const swell = Math.sin(x * freq * 0.35 + t * props.speed * 0.55 + line.phase * 1.7) * amp * 0.45
        let y = baseY + drift + swell
        // 指针吸引：横向高斯衰减，纵向拉向指针，上限 8px。
        const dx = x - pointer.x
        const gauss = Math.exp(-(dx * dx) / (2 * 160 * 160))
        const pull = Math.max(-MAX_PULL, Math.min(MAX_PULL, (pointer.y - y) / 24)) * gauss
        y += pointer.x < -999 ? 0 : pull
        if (x <= 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  const active = () => onScreen && document.visibilityState !== 'hidden'

  const frame = (now: number) => {
    raf = 0
    draw(now / 1000)
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
.tide-field {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
