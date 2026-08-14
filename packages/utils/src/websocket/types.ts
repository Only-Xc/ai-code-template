/**
 * WebSocket 原生 send 方法支持的 payload 类型。
 */
export type WebSocketSendPayload = Parameters<WebSocket['send']>[0]

/**
 * WebSocketWrapper 当前连接状态。
 */
export type WebSocketWrapperState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
  | 'reconnecting'

/**
 * 可选日志接口。默认不输出日志，需要业务侧主动注入。
 */
export interface WebSocketLogger {
  /**
   * 调试日志，适合记录重连计划等低优先级信息。
   */
  debug?: (message: string, detail?: unknown) => void

  /**
   * 错误日志，适合记录连接异常和 WebSocket error 事件。
   */
  error?: (message: string, detail?: unknown) => void

  /**
   * 普通信息日志，适合记录连接成功、连接断开等状态。
   */
  info?: (message: string, detail?: unknown) => void
}

/**
 * 每次准备自动重连时触发的事件数据。
 */
export interface WebSocketReconnectEvent {
  /**
   * 当前重连次数，从 1 开始。
   */
  attempt: number

  /**
   * 本次重连等待时间，单位毫秒，已包含 jitter。
   */
  delay: number

  /**
   * 最大重连次数。
   */
  maxAttempts: number
}

/**
 * 自动重连停止时触发的事件数据。
 */
export interface WebSocketReconnectFailedEvent {
  /**
   * 已经尝试的重连次数。
   */
  attempts: number

  /**
   * 停止重连的原因。
   */
  reason: 'max-attempts' | 'reconnect-disabled'
}

/**
 * 连接状态变化事件数据。
 */
export interface WebSocketStateChangeEvent {
  /**
   * 当前状态。
   */
  current: WebSocketWrapperState

  /**
   * 变化前状态。
   */
  previous: WebSocketWrapperState
}

/**
 * WebSocketWrapper 支持订阅的事件列表。
 */
export interface WebSocketWrapperEventMap {
  /**
   * 原生 WebSocket close 事件。
   */
  close: CloseEvent

  /**
   * 原生 WebSocket error 事件。
   */
  error: Event

  /**
   * 原生 WebSocket message 事件。
   */
  message: MessageEvent

  /**
   * 原生 WebSocket open 事件。
   */
  open: Event

  /**
   * 准备自动重连时触发。
   */
  reconnect: WebSocketReconnectEvent

  /**
   * 自动重连停止时触发。
   */
  reconnectFailed: WebSocketReconnectFailedEvent

  /**
   * 内部连接状态变化时触发。
   */
  stateChange: WebSocketStateChangeEvent
}

/**
 * WebSocketWrapper 创建配置。
 */
export interface WebSocketWrapperOptions {
  /**
   * 是否在构造后立即连接，默认 true。
   *
   * 需要先绑定事件再连接时，建议设置为 false，然后手动调用 connect()。
   */
  autoConnect?: boolean

  /**
   * 心跳 payload。可以传固定值，也可以传函数动态生成。
   *
   * 默认发送字符串 "heartbeat"。
   */
  heartbeatData?: WebSocketSendPayload | (() => WebSocketSendPayload)

  /**
   * 心跳间隔，单位毫秒，默认 30000。设置为 0 或负数时关闭心跳。
   */
  heartbeatInterval?: number

  /**
   * 页面隐藏时是否继续发送心跳，默认 true。
   *
   * 设置为 false 时，页面隐藏会停止心跳，页面恢复可见后会恢复心跳或重新连接。
   */
  heartbeatWhenHidden?: boolean

  /**
   * 可选日志实现。默认静默。
   */
  logger?: WebSocketLogger

  /**
   * 最大自动重连次数，默认 Infinity。
   */
  maxReconnectAttempts?: number

  /**
   * 最大重连间隔，单位毫秒，默认 60000。
   */
  maxReconnectInterval?: number

  /**
   * 初始重连间隔，单位毫秒，默认 1000。
   */
  reconnectInterval?: number

  /**
   * 重连随机抖动比例，默认 0.2。
   *
   * 例如基础延迟为 1000ms 时，最终延迟范围约为 1000ms 到 1200ms。
   */
  reconnectJitterRatio?: number

  /**
   * 根据 close 事件判断是否自动重连。
   *
   * 常见用法：code 为 1000 正常关闭时返回 false，鉴权失败时返回 false。
   */
  shouldReconnect?: (event: CloseEvent) => boolean
}
