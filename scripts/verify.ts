import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const full = args.includes('--full')

function run(command: string[]): number {
  console.log('+ ' + command.join(' '))
  const result = spawnSync(command[0], command.slice(1), {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
  return result.status ?? 1
}

// fast 层：lint -> format -> typecheck -> 单测 -> e2e
const checks: Array<[string, string[]]> = [
  ['lint', ['pnpm', '--filter', '@template/backend', 'lint']],
  ['format:check', ['pnpm', 'format:check']],
  ['typecheck', ['pnpm', 'typecheck']],
  ['test', ['pnpm', '--filter', '@template/backend', 'test']],
  ['test:e2e', ['pnpm', '--filter', '@template/backend', 'test:e2e']],
]

if (full) {
  checks.push(['build', ['pnpm', '--filter', '@template/backend', 'build']])
  // 本地校验用 .env.development（deploy.ts 的 build 需要 .env.production，新克隆没有）
  checks.push([
    'compose build',
    [
      'docker',
      'compose',
      '--project-directory',
      '.',
      '--env-file',
      '.env.development',
      '-f',
      'deploy/compose/compose.yml',
      '-f',
      'deploy/compose/compose.override.yml',
      'build',
    ],
  ])
}

for (const [name, command] of checks) {
  console.log(`== ${name} ==`)
  const code = run(command)
  if (code !== 0) {
    console.error(`FAILED: ${name}`)
    process.exit(code)
  }
}

console.log('All checks passed.')
