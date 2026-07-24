import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Maintenance from './Maintenance.tsx'

// MAINTENANCE MODE: the editor is temporarily disabled for everyone EXCEPT the
// allowlisted merchant(s) below. `mid` is how the embed identifies the merchant
// (same URL param App.tsx boots from). Allowlisted mids get the full editor;
// every other request sees the maintenance screen.
// To fully restore: render <App /> unconditionally (or empty the allowlist).
const MAINTENANCE_ALLOWLIST_MIDS = ['196cu30silqg']

const mid = new URLSearchParams(window.location.search).get('mid')
const editorEnabled = !!mid && MAINTENANCE_ALLOWLIST_MIDS.includes(mid)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{editorEnabled ? <App /> : <Maintenance />}</StrictMode>,
)
