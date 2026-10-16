// Sound + spark effects for the "Surprise me" slot-machine overlay.
// Everything is synthesised (Web Audio + canvas), so there are no asset files.

let ctx = null
let bus = null // master chain: gain -> compressor -> speakers

export function primeAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      const master = ctx.createGain()
      master.gain.value = 0.9
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.ratio.value = 6
      master.connect(comp)
      comp.connect(ctx.destination)
      bus = master
    }
    if (ctx.state === 'suspended') ctx.resume()
  } catch { ctx = null; bus = null }
  return ctx
}

const buzz = (p) => { try { navigator.vibrate?.(p) } catch { /* ignore */ } }

function tone(freq, { type = 'square', dur = 0.06, vol = 0.06, at = 0, to = 0, attack = 0.004 } = {}) {
  if (!ctx || !bus) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(bus)
  o.start(t)
  o.stop(t + dur + 0.03)
}

function noise({ dur = 0.4, vol = 0.05, from = 400, to = 4000, at = 0, q = 1.2, type = 'bandpass' } = {}) {
  if (!ctx || !bus) return
  const t = ctx.currentTime + at
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(bus)
  src.start(t)
}

// Reel start: a short rising whoosh.
export function whoosh() {
  noise({ dur: 0.35, vol: 0.03, from: 300, to: 2600, q: 0.9 })
  tone(160, { type: 'triangle', dur: 0.3, vol: 0.03, to: 640 })
  buzz(15)
}

// One clean click per card; every card is a little higher than the last.
export function tick(n) {
  const f = 320 * Math.pow(1.055, n)
  tone(f, { type: 'square', dur: 0.05, vol: 0.045 })
  tone(f * 2, { type: 'triangle', dur: 0.035, vol: 0.025 })
  buzz(6)
}

// Landing: soft thump, then a bright rising arpeggio and a few sparkles.
export function win() {
  tone(110, { type: 'sine', dur: 0.4, vol: 0.14, to: 48 })
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    tone(f, { type: 'triangle', dur: 0.32, vol: 0.06, at: 0.08 + i * 0.07 })
    tone(f * 2, { type: 'sine', dur: 0.22, vol: 0.018, at: 0.08 + i * 0.07 })
  })
  for (let i = 0; i < 6; i++) tone(2400 + Math.random() * 2000, { type: 'sine', dur: 0.08, vol: 0.02, at: 0.4 + i * 0.06 })
  buzz([30, 40, 60])
}

const COLORS = ['#ffd24a', '#fff3b0', '#ffb02e', '#ffffff', '#ff6a4d', '#ff8fd1', '#7ad7ff']

// Sparks + confetti on a full-screen canvas. Returns { burst, confetti, stop }.
export function sparks(canvas) {
  const c = canvas.getContext('2d')
  let parts = []
  let raf = 0
  let w = 0
  let h = 0
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth; h = window.innerHeight
    canvas.width = w * dpr; canvas.height = h * dpr
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  size()
  window.addEventListener('resize', size)

  const frame = () => {
    c.clearRect(0, 0, w, h)
    parts = parts.filter((p) => p.life > 0 && p.y < h + 40)
    for (const p of parts) {
      p.life -= 1
      p.vy += p.g
      p.vx *= p.drag
      p.vy *= p.drag
      p.x += p.vx
      p.y += p.vy
      const a = Math.min(1, (p.life / p.max) * 2)
      c.globalAlpha = a
      c.fillStyle = p.color
      if (p.rect) {
        p.rot += p.vr
        c.globalCompositeOperation = 'source-over'
        c.save()
        c.translate(p.x, p.y)
        c.rotate(p.rot)
        c.scale(1, Math.cos(p.rot * 1.7))
        c.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r)
        c.restore()
      } else {
        c.globalCompositeOperation = 'lighter'
        c.beginPath()
        c.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, 6.283)
        c.fill()
      }
    }
    c.globalAlpha = 1
    raf = parts.length ? requestAnimationFrame(frame) : 0
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame) }
  const pick = () => COLORS[(Math.random() * COLORS.length) | 0]

  return {
    burst(x, y, n, { speed = 7, g = 0.18, life = 46, r = 2.4, spread = 6.283, angle = 0, drag = 0.985 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - 0.5) * spread
        const s = speed * (0.35 + Math.random() * 0.75)
        const l = life * (0.6 + Math.random() * 0.6)
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, drag, life: l, max: l, r: r * (0.5 + Math.random()), color: pick() })
      }
      kick()
    },
    // Paper confetti raining from the top edge.
    confetti(n = 90) {
      for (let i = 0; i < n; i++) {
        const l = 140 + Math.random() * 120
        parts.push({ x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 2.4, vy: 1.5 + Math.random() * 2.5, g: 0.02, drag: 0.995, life: l, max: l * 1.4, r: 3 + Math.random() * 4, rect: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, color: pick() })
      }
      kick()
    },
    stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', size); parts = [] },
  }
}
