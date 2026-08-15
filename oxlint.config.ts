import { defineConfig } from 'oxlint'
import { templateIgnorePatterns } from '@template/tooling/ignores'

export default defineConfig({
  ignorePatterns: templateIgnorePatterns,
})
