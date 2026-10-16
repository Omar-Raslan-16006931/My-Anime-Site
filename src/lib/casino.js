// Sound + spark effects for the "Surprise me" slot-machine overlay.
// Everything is synthesised (Web Audio + canvas), so there are no asset files.

let ctx = null
export function primeAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { ctx = null }
  return ctx
}

const buzz = (ms) => { try { navigator.vibrate?.(ms) } catch { /* ignore */ } }

function tone(freq, { type = 'square', dur = 0.06, vol = 0.06, at = 0, to = 0 } = {}) {
  if (!ctx) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise({ dur = 0.4, vol = 0.05, from = 400, to = 4000, at = 0, q = 1.2 } = {}) {
  if (!ctx) return
  const t = ctx.currentTime + at
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(ctx.destination)
  src.start(t)
}

// Reel start: a rising whoosh.
export function whoosh() { noise({ dur: 0.55, vol: 0.05, from: 300, to: 3200 }); tone(140, { type: 'sawtooth', dur: 0.4, vol: 0.03, to: 520 }); buzz(18) }

// One click per card; every card is a little higher than the last.
export function tick(n) {
  const f = 320 * Math.pow(1.055, n)
  tone(f, { type: 'square', dur: 0.05, vol: 0.05 })
  tone(f * 2, { type: 'triangle', dur: 0.035, vol: 0.03 })
  buzz(6)
}

// Landing: thump, rising arpeggio, coin sparkle.
export function win() {
  tone(110, { type: 'sine', dur: 0.35, vol: 0.18, to: 45 })
  noise({ dur: 0.25, vol: 0.08, from: 2000, to: 800, q: 0.7 })
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    tone(f, { type: 'triangle', dur: 0.3, vol: 0.07, at: 0.08 + i * 0.07 })
    tone(f * 2, { type: 'sine', dur: 0.22, vol: 0.025, at: 0.08 + i * 0.07 })
  })
  for (let i = 0; i < 7; i++) tone(2200 + Math.random() * 2600, { type: 'sine', dur: 0.09, vol: 0.03, at: 0.3 + i * 0.055 })
  noise({ dur: 0.9, vol: 0.03, from: 5000, to: 9000, at: 0.3, q: 0.8 })
  buzz(40)
}

const COLORS = ['#ffd24a', '#fff3b0', '#ffb02e', '#ffffff', '#ff6a4d']

// Particle sparks on a full-screen canvas. Returns { burst, stop }.
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
    c.globalCompositeOperation = 'lighter'
    parts = parts.filter((p) => p.life > 0)
    for (const p of parts) {
      p.life -= 1
      p.vy += p.g
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      const a = Math.max(0, p.life / p.max)
      c.globalAlpha = a
      c.fillStyle = p.color
      c.beginPath()
      c.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, 6.283)
      c.fill()
    }
    c.globalAlpha = 1
    raf = parts.length ? requestAnimationFrame(frame) : 0
  }

  return {
    burst(x, y, n, { speed = 7, g = 0.18, life = 46, r = 2.4, spread = 6.283, angle = 0 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - 0.5) * spread
        const s = speed * (0.35 + Math.random() * 0.75)
        const l = life * (0.6 + Math.random() * 0.6)
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, life: l, max: l, r: r * (0.5 + Math.random()), color: COLORS[(Math.random() * COLORS.length) | 0] })
      }
      if (!raf) raf = requestAnimationFrame(frame)
    },
    stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', size); parts = [] },
  }
}
