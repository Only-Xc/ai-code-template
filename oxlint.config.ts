import { defineConfig } from 'oxlint'
import { aiAppIgnorePatterns } from '@ai-app/tooling/ignores'

export default defineConfig({
  ignorePatterns: aiAppIgnorePatterns,
})
