export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  decay: number
}

interface ParticleBurstOptions {
  animationRef: { current: number | null }
  canvas: HTMLCanvasElement | null
  hueOffset: number
  hueOffsets: number[]
  lightness: number[]
  particlesRef: { current: Particle[] }
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360
}

function getRootHue() {
  const hue = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hue'))
  return Number.isFinite(hue) ? hue : 250
}

function getParticleColors(hueOffset: number, hueOffsets: number[], lightness: number[]) {
  const baseHue = getRootHue() + hueOffset

  return hueOffsets.map(
    (offset, index) => `hsl(${normalizeHue(baseHue + offset)} 88% ${lightness[index]}%)`,
  )
}

export function prefersReducedParticleMotion(reduceMotion: boolean | null) {
  return (
    reduceMotion === true ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

export function spawnParticleBurst({
  animationRef,
  canvas,
  hueOffset,
  hueOffsets,
  lightness,
  particlesRef,
}: ParticleBurstOptions) {
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

  const colors = getParticleColors(hueOffset, hueOffsets, lightness)
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const newParticles: Particle[] = []
  const count = 16

  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count + (Math.random() - 0.5) * 0.4
    const speed = 1.8 + Math.random() * 2.8

    newParticles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.6,
      size: 2 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 0.025 + Math.random() * 0.02,
    })
  }

  particlesRef.current = [...particlesRef.current, ...newParticles]

  if (animationRef.current) return

  const update = () => {
    const currentCanvas = canvas
    const currentCtx = currentCanvas.getContext('2d')

    if (!currentCtx) {
      animationRef.current = null
      return
    }

    const width = currentCanvas.width / window.devicePixelRatio
    const height = currentCanvas.height / window.devicePixelRatio
    currentCtx.clearRect(0, 0, width, height)

    const activeParticles: Particle[] = []

    for (const particle of particlesRef.current) {
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vy += 0.09
      particle.vx *= 0.97
      particle.vy *= 0.97
      particle.alpha -= particle.decay

      if (particle.alpha <= 0) continue

      currentCtx.save()
      currentCtx.globalAlpha = particle.alpha
      currentCtx.beginPath()
      currentCtx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI)
      currentCtx.fillStyle = particle.color
      currentCtx.fill()
      currentCtx.restore()
      activeParticles.push(particle)
    }

    particlesRef.current = activeParticles

    if (activeParticles.length > 0) {
      animationRef.current = requestAnimationFrame(update)
    } else {
      animationRef.current = null
    }
  }

  animationRef.current = requestAnimationFrame(update)
}
