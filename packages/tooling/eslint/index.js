import js from '@eslint/js'
import stylisticPlugin from '@stylistic/eslint-plugin'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importPlugin from 'eslint-plugin-import-x'
import nodePlugin from 'eslint-plugin-n'
import oxlint from 'eslint-plugin-oxlint'
import reactDom from 'eslint-plugin-react-dom'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactX from 'eslint-plugin-react-x'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { aiAppIgnorePatterns } from '../ignores.js'

const tsconfigRootDir = new URL('../../..', import.meta.url).pathname

export const eslintConfig = defineConfig([
  {
    name: '@ai-app/ignores',
    ignores: aiAppIgnorePatterns,
  },
  {
    name: '@ai-app/javascript',
    files: ['**/*.{js,ts,tsx}'],
    extends: [
      'js/recommended',
      '@typescript-eslint/recommended-type-checked',
      '@typescript-eslint/stylistic-type-checked',
      'import-x/flat/recommended',
      'import-x/flat/typescript',
    ],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2020,
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'packages/tooling/eslint/*.js',
            'packages/tooling/ignores.js',
          ],
        },
        tsconfigRootDir,
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      js,
      '@typescript-eslint': tseslint.plugin,
      '@stylistic': stylisticPlugin,
      'import-x': importPlugin,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: [
            'apps/*/tsconfig.json',
            'packages/*/tsconfig.json',
          ],
        }),
      ],
    },
    rules: {
      // 允许 Array<T> 和 T[] 混用，团队无统一偏好
      '@typescript-eslint/array-type': 'off',
      // prefer-nullish-coalescing: 使用 ?? 替代 ||，避免 0/''/false 被误判为默认值
      // 部分 async 函数暂无 await（如接口占位）
      '@typescript-eslint/require-await': 'off',
      '@stylistic/spaced-comment': 'error',
      // 循环依赖检测关闭，依赖 madge 等工具单独检查
      'import-x/no-cycle': 'off',
      // re-export 场景常见，关闭误报
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      // import 排序暂不强制，后续可接入 eslint-plugin-import-x/order
      'import-x/order': 'off',
      'sort-imports': 'off',
    },
  },
  {
    name: '@ai-app/node',
    files: [
      '**/*.config.{js,ts,mjs,cjs}'
    ],
    extends: ['n/flat/recommended-module'],
    languageOptions: {
      globals: globals.node,
    },
    plugins: {
      n: nodePlugin,
    },
    rules: {
      'n/prefer-node-protocol': 'error',
    },
  },
  {
    name: '@ai-app/react',
    files: [
      'apps/**/*.{ts,tsx}',
      'packages/**/*.{ts,tsx}',
    ],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    rules: {
      // 与 react 19 的 use() / useSyncExternalStore 模式冲突，暂关
      'react-hooks/set-state-in-effect': 'off',
      'react-x/set-state-in-effect': 'off',
    },
  },
  {
    name: '@ai-app/react-vite-refresh',
    files: ['apps/**/*.{ts,tsx}'],
    extends: [reactRefresh.configs.vite],
  },
  // oxlint 在最后：关闭已被 oxlint CLI (先于 eslint 执行) 覆盖的 ~220 条 correctness 规则
  ...oxlint.configs['flat/recommended'],
])
