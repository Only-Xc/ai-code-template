import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCTION_ENV_FILE = '.env.production'
const COMPOSE_FILES = ['-f', 'deploy/compose/compose.yml']
const COMPOSE_ENV_FILE = ['--env-file', PRODUCTION_ENV_FILE]
const MIGRATION_COMMAND = [
  'run',
  '--rm',
  '--no-deps',
  'backend',
  'prisma',
  'migrate',
  'deploy',
]

function composeCommand(...args: string[]): string[] {
  // 生产命令固定 project-directory 和 env-file，避免在子目录执行时路径漂移。
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

function ensureFileExists(path: string): void {
  if (!existsSync(resolve(REPO_ROOT, path))) {
    // 生产部署依赖显式 env 文件，缺失时停止，避免 Docker Compose 用空变量启动。
    console.error(`Missing required file: ${path}`)
    process.exit(1)
  }
}

function ensureDockerAvailable(): void {
  const result = spawnSync('docker', ['--version'], { stdio: 'ignore' })
  if (result.status !== 0) {
    console.error('Docker is unavailable. Install Docker Engine first.')
    process.exit(result.status ?? 1)
  }
}

const command = process.argv[2]
if (!command) {
  console.error(
    'usage: deploy.ts <build|up|deploy|down|restart|logs|status|migrate|pull>',
  )
  process.exit(1)
}

if (command === 'pull') {
  process.exit(run(['git', 'pull', '--fast-only']))
}

ensureFileExists(PRODUCTION_ENV_FILE)
ensureDockerAvailable()

switch (command) {
  case 'build':
    process.exit(run(composeCommand('build')))
  case 'up':
    process.exit(run(composeCommand('up', '-d')))
  case 'deploy': {
    // 部署顺序固定为 build -> migrate -> up，避免新镜像启动在旧 schema 上。
    const buildCode = run(composeCommand('build'))
    if (buildCode !== 0) process.exit(buildCode)
    const migrateCode = run(composeCommand(...MIGRATION_COMMAND))
    if (migrateCode !== 0) process.exit(migrateCode)
    process.exit(run(composeCommand('up', '-d')))
  }
  case 'down':
    process.exit(run(composeCommand('down', '--remove-orphans')))
  case 'restart':
    process.exit(run(composeCommand('restart', 'backend')))
  case 'logs':
    process.exit(run(composeCommand('logs', '-f', 'backend')))
  case 'status':
    process.exit(run(composeCommand('ps')))
  case 'migrate':
    process.exit(run(composeCommand(...MIGRATION_COMMAND)))
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
