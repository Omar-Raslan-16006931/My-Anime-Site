import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './fusion.css'
import './buttons.css'
import App from './App.jsx'

// Block iOS Safari's pinch-zoom gesture (it ignores user-scalable=no).
// Double-tap zoom is already off via `touch-action` in index.css.
if (typeof window !== 'undefined') {
  const stop = (e) => e.preventDefault()
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })
  document.addEventListener('gestureend', stop, { passive: false })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)