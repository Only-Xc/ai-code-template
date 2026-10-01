import { defineConfig } from 'vitest/config'

// 不使用 @vitejs/plugin-react：vitest 3.2 类型基于 vite 7，与本仓 vite 8 冲突；
// esbuild automatic JSX 对本测试场景（无 React Compiler 依赖）足够
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
