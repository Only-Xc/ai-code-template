import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.tsx'
import { ensureI18nReady } from './i18n'

const root = createRoot(document.getElementById('root')!)

// 启动链路失败不白屏：记录错误后继续渲染，i18next 回退到 key 展示可诊断
void ensureI18nReady()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    console.error('i18n 初始化失败，使用降级渲染', error)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
