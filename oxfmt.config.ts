import { defineConfig } from 'oxfmt'
import { aiAppIgnorePatterns } from '@ai-app/tooling/ignores'

export default defineConfig({
  ignorePatterns: aiAppIgnorePatterns,
  semi: false,
  singleQuote: true,
  printWidth: 80,
  sortPackageJson: false,
  overrides: [
    {
      files: ['**/*.json5'],
      options: {
        singleQuote: false,
        quoteProps: 'preserve',
      },
    },
    {
      files: ['**/*.yml', '**/*.yaml'],
      options: {
        singleQuote: false,
      },
    },
  ],
})
