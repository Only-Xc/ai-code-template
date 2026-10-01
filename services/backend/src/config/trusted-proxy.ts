import { isIP } from 'node:net'

const MINIMUM_IPV4_CIDR_PREFIX = 24
const MINIMUM_IPV6_CIDR_PREFIX = 64

/**
 * 读取 Fastify 可信任转发地址的确切反向代理对等端。
 * 只接受精确 IP 或受控 CIDR（IPv4 至少 /24、IPv6 至少 /64）；
 * 空数组刻意让直接连接不可信（不使用 x-forwarded-for）。
 */
export function readTrustedProxyIps(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new Error('server.trustedProxyIps 必须是 IP 地址或受控 CIDR 的数组')
  }
  return [...new Set(value.map(readTrustedProxyIp))]
}

function readTrustedProxyIp(value: unknown): string {
  if (typeof value !== 'string' || value !== value.trim() || !value) {
    throw new Error('server.trustedProxyIps 不能包含空地址')
  }
  if (isIP(value)) return value

  const [address, prefix, ...rest] = value.split('/')
  const version = isIP(address)
  if (!version || !prefix || rest.length || !/^\d+$/u.test(prefix)) {
    throw new Error(`server.trustedProxyIps 包含无效地址：${value}`)
  }
  const numericPrefix = Number(prefix)
  const minimumPrefix =
    version === 4 ? MINIMUM_IPV4_CIDR_PREFIX : MINIMUM_IPV6_CIDR_PREFIX
  const maximumPrefix = version === 4 ? 32 : 128
  if (numericPrefix < minimumPrefix || numericPrefix > maximumPrefix) {
    throw new Error(
      `server.trustedProxyIps 只接受 IPv${version} /${minimumPrefix} 或更精确的受控 CIDR`,
    )
  }
  return value
}
