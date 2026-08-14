import type { DictRegistry } from './types.js'

export const dictRegistry = {
  demo: [
    { label: 'UAT', value: 'UAT', color: 'cyan' },
    { label: 'PROD', value: 'PROD', color: 'blue' },
  ],
} as const satisfies DictRegistry
