import { useEffect, useState } from 'react'

// Renders toasts fired via lib/toast. Each one slides up, lingers, fades out.
export default function Toasts() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const onToast = (e) => {
      const id = Date.now() + Math.random()
      setItems((p) => [...p.slice(-2), { id, msg: e.detail.msg, leaving: false }])
      setTimeout(() => setItems((p) => p.map((t) => (t.id === id ? { ...t, leaving: true } : t))), 2300)
      setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 2650)
    }
    window.addEventListener('app:toast', onToast)
    return () => window.removeEventListener('app:toast', onToast)
  }, [])

  if (!items.length) return null
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={'toast' + (t.leaving ? ' out' : '')}>{t.msg}</div>
      ))}
    </div>
  )
}
