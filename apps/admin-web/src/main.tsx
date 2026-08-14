import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.tsx'
import { ensureI18nReady } from './i18n'

const root = createRoot(document.getElementById('root')!)

void ensureI18nReady().then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
