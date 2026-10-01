import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

import { merge, get, set } from 'lodash-es'

/** 生产环境由环境变量覆盖的连接配置：{yaml 路径, 环境变量名}。 */
const ENV_OVERRIDES: Array<[string, string]> = [
  ['database.url', 'DATABASE_URL'],
  ['auth.jwtSecret', 'JWT_SECRET'],
  ['storage.endpoint', 'OBJECT_STORAGE_ENDPOINT'],
  ['storage.accessKey', 'OBJECT_STORAGE_ACCESS_KEY'],
  ['storage.secretKey', 'OBJECT_STORAGE_SECRET_KEY'],
  ['storage.bucket', 'OBJECT_STORAGE_BUCKET'],
  ['storage.region', 'OBJECT_STORAGE_REGION'],
]

export function getEnv() {
  return process.env.RUNNING_ENV ?? 'dev'
}

export function getEnvFilePath(name) {
  return join(__dirname, `./envs/${name}.yaml`)
}

export function parseYaml(yamlPath) {
  if (!yamlPath) {
    throw new Error('请传入路径')
  }

  const file = readFileSync(yamlPath, 'utf-8')
  const config = parse(file)
  return config
}

function applyRedisEnvOverride(config) {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return
  }

  const parsed = new URL(redisUrl)
  set(config, 'redis', {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    auth: parsed.password || '',
    db: Number(parsed.pathname.slice(1) || 0),
  })
}

function applyEnvOverrides(config) {
  for (const [path, envVar] of ENV_OVERRIDES) {
    const value = process.env[envVar]
    if (value !== undefined && value !== '') {
      set(config, path, value)
    }
  }
  applyRedisEnvOverride(config)
}

let baseYamlConfig
let envYamlConfig

// 配置值来自动态 YAML，类型无法静态确定
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configuration(): Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configuration(path: string): any
export function configuration(path?: string) {
  const environment = getEnv()

  baseYamlConfig = baseYamlConfig ?? parseYaml(getEnvFilePath('base'))
  envYamlConfig = envYamlConfig ?? parseYaml(getEnvFilePath(environment))

  const mergeConfig = merge({}, baseYamlConfig, envYamlConfig)

  applyEnvOverrides(mergeConfig)

  if (path) {
    return get(mergeConfig, path)
  }

  return mergeConfig
}
