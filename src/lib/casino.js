// Sound + spark effects for the "Surprise me" slot-machine overlay.
// Everything is synthesised (Web Audio + canvas), so there are no asset files.

let ctx = null
let bus = null // master chain: gain -> compressor -> speakers, plus a soft echo for shine

export function primeAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      const master = ctx.createGain()
      master.gain.value = 0.9
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.ratio.value = 6
      const echo = ctx.createDelay(0.5)
      echo.delayTime.value = 0.17
      const fb = ctx.createGain()
      fb.gain.value = 0.28
      const wet = ctx.createGain()
      wet.gain.value = 0.22
      master.connect(comp)
      master.connect(echo)
      echo.connect(fb).connect(echo)
      echo.connect(wet).connect(comp)
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

// Major pentatonic ladder, so the climbing ticks always sound musical.
const PENT = [0, 2, 4, 7, 9]
const ladder = (step) => 196 * Math.pow(2, (PENT[step % 5] + 12 * Math.floor(step / 5)) / 12)

// Reel start: whoosh + a rising engine sweep.
export function whoosh() {
  noise({ dur: 0.6, vol: 0.06, from: 250, to: 3600, q: 0.9 })
  tone(90, { type: 'sawtooth', dur: 0.55, vol: 0.035, to: 480 })
  tone(180, { type: 'triangle', dur: 0.5, vol: 0.03, to: 960 })
  buzz(18)
}

// One mechanical click per card, a little higher each time. `p` is progress 0..1.
export function tick(n, total) {
  const p = n / total
  const f = ladder(Math.floor(p * 14))
  tone(f, { type: 'square', dur: 0.055, vol: 0.045 })
  tone(f * 2, { type: 'triangle', dur: 0.04, vol: 0.03 })
  noise({ dur: 0.03, vol: 0.05 + p * 0.03, from: 3000, to: 6000, q: 0.8 }) // ratchet
  if (p > 0.72) tone(f / 2, { type: 'sine', dur: 0.09, vol: 0.07 * p }) // growing thud as it slows
  buzz(5 + Math.round(p * 8))
}

// Short drum-roll while the last card hangs before landing.
export function drumroll(ms = 520) {
  const hits = Math.round(ms / 45)
  for (let i = 0; i < hits; i++) {
    const at = (i * ms) / hits / 1000
    const v = 0.03 + (i / hits) * 0.07
    noise({ dur: 0.05, vol: v, from: 900, to: 300, at, q: 0.6 })
    tone(130 + i * 3, { type: 'sine', dur: 0.05, vol: v * 0.9, at })
  }
  tone(300, { type: 'sawtooth', dur: ms / 1000, vol: 0.02, to: 1500 })
}

// Landing: boom, bright major chord with bell overtones, rising run, coin shower.
export function win() {
  tone(120, { type: 'sine', dur: 0.5, vol: 0.28, to: 40 })
  noise({ dur: 0.35, vol: 0.1, from: 2500, to: 500, q: 0.6 })
  const run = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
  run.forEach((f, i) => {
    const at = 0.1 + i * 0.065
    tone(f, { type: 'triangle', dur: 0.45, vol: 0.075, at })
    tone(f * 2.01, { type: 'sine', dur: 0.35, vol: 0.03, at }) // bell overtone
    tone(f * 3, { type: 'sine', dur: 0.2, vol: 0.012, at })
  })
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, { type: 'sawtooth', dur: 1.0, vol: 0.022, at: 0.5, attack: 0.02 }))
  for (let i = 0; i < 14; i++) tone(2400 + Math.random() * 3200, { type: 'sine', dur: 0.1, vol: 0.028, at: 0.35 + i * 0.05 })
  noise({ dur: 1.1, vol: 0.028, from: 6000, to: 11000, at: 0.35, q: 0.7, type: 'highpass' })
  buzz([30, 40, 30, 40, 80])
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
