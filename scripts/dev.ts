import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COMPOSE_FILES = [
  '-f',
  'deploy/compose/compose.yml',
  '-f',
  'deploy/compose/compose.override.yml',
]
const COMPOSE_ENV_FILE = ['--env-file', '.env.development']
const LOCAL_DEPENDENCY_SERVICES = ['db', 'redis', 'minio']

function composeCommand(...args: string[]): string[] {
  return [
    'docker',
    'compose',
    '--project-directory',
    '.',
    ...COMPOSE_ENV_FILE,
    ...COMPOSE_FILES,
    ...args,
  ]
}

function run(command: string[]): number {
  console.log('+ ' + command.join(' '))
  const result = spawnSync(command[0], command.slice(1), {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
  if (result.signal === 'SIGINT') {
    process.exit(130)
  }
  return result.status ?? 1
}

const command = process.argv[2]
if (!command) {
  console.error(
    'usage: dev.ts <api|compose-up|compose-down|compose-logs|migrate|migrate-deploy>',
  )
  process.exit(1)
}

switch (command) {
  case 'api':
    process.exit(run(['pnpm', '--filter', '@template/backend', 'start:dev']))
  case 'compose-up':
    process.exit(
      run(
        composeCommand(
          'up',
          '-d',
          '--remove-orphans',
          ...LOCAL_DEPENDENCY_SERVICES,
        ),
      ),
    )
  case 'compose-down':
    process.exit(run(composeCommand('down', '--remove-orphans')))
  case 'compose-logs':
    process.exit(
      run(composeCommand('logs', '-f', ...LOCAL_DEPENDENCY_SERVICES)),
    )
  case 'migrate':
    process.exit(
      run(['pnpm', '--filter', '@template/backend', 'prisma:migrate']),
    )
  case 'migrate-deploy':
    process.exit(
      run(['pnpm', '--filter', '@template/backend', 'prisma:migrate:deploy']),
    )
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
