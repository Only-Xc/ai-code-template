import { EventEmitter } from './event-emitter.js'
import type { EventListener } from './event-emitter.js'
import type {
  WebSocketLogger,
  WebSocketReconnectFailedEvent,
  WebSocketReconnectEvent,
  WebSocketSendPayload,
  WebSocketStateChangeEvent,
  WebSocketWrapperEventMap,
  WebSocketWrapperOptions,
  WebSocketWrapperState,
} from './types.js'

/**
 * 默认心跳内容。
 */
const DEFAULT_HEARTBEAT_DATA = 'heartbeat'

/**
 * 默认心跳间隔，单位毫秒。
 */
const DEFAULT_HEARTBEAT_INTERVAL = 30 * 1000

/**
 * 默认最大重连次数，表示一直尝试重连。
 */
const DEFAULT_MAX_RECONNECT_ATTEMPTS = Number.POSITIVE_INFINITY

/**
 * 默认最大重连间隔，单位毫秒。
 */
const DEFAULT_MAX_RECONNECT_INTERVAL = 60 * 1000

/**
 * 默认初始重连间隔，单位毫秒。
 */
const DEFAULT_RECONNECT_INTERVAL = 1000

/**
 * 默认重连随机抖动比例。
 */
const DEFAULT_RECONNECT_JITTER_RATIO = 0.2

/**
 * 浏览器连接创建失败时使用的异常关闭码。
 */
const CONNECTION_FAILURE_CLOSE_CODE = 1006

/**
 * 浏览器连接创建失败时使用的内部原因。
 */
const CONNECTION_FAILURE_CLOSE_REASON = 'connection-failed'

/**
 * 浏览器 WebSocket 包装器。
 *
 * 提供事件订阅、自动重连、心跳、状态追踪和 JSON 发送能力。
 */
export class WebSocketWrapper {
  /**
   * 内部事件中心，用于转发原生 WebSocket 事件和包装器扩展事件。
   */
  private readonly events = new EventEmitter<WebSocketWrapperEventMap>()

  /**
   * 心跳发送内容，可以是固定 payload，也可以是动态生成函数。
   */
  private readonly heartbeatData:
    | WebSocketSendPayload
    | (() => WebSocketSendPayload)

  /**
   * 心跳发送间隔，单位毫秒。
   */
  private readonly heartbeatInterval: number

  /**
   * 页面隐藏时是否继续发送心跳。
   */
  private readonly heartbeatWhenHidden: boolean

  /**
   * 初始重连间隔，重连成功后会恢复到该值。
   */
  private readonly initialReconnectInterval: number

  /**
   * 可选日志实现，默认静默。
   */
  private readonly logger?: WebSocketLogger

  /**
   * 最大自动重连次数。
   */
  private readonly maxReconnectAttempts: number

  /**
   * 最大重连间隔，指数退避不会超过该值。
   */
  private readonly maxReconnectInterval: number

  /**
   * 重连随机抖动比例，用于降低集中重连压力。
   */
  private readonly reconnectJitterRatio: number

  /**
   * 自动重连判断函数。
   */
  private readonly shouldReconnect: (event: CloseEvent) => boolean

  /**
   * WebSocket 连接地址。
   */
  private readonly url: string

  /**
   * 心跳定时器 ID。
   */
  private heartbeatTimer: number | null = null

  /**
   * 当前连续重连次数。
   */
  private reconnectAttempts = 0

  /**
   * 当前重连间隔，失败后会按指数退避递增。
   */
  private reconnectInterval: number

  /**
   * 重连定时器 ID。
   */
  private reconnectTimer: number | null = null

  /**
   * 当前 WebSocket 实例。
   */
  private socket: WebSocket | null = null

  /**
   * 是否已被主动停止。主动 close/destroy 后会阻止自动重连。
   */
  private stopped = false

  /**
   * 页面可见性变化监听器。
   */
  private visibilityListener: (() => void) | null = null

  /**
   * 当前包装器状态。
   */
  private wrapperState: WebSocketWrapperState = 'idle'

  /**
   * 创建 WebSocketWrapper 实例。
   *
   * 默认会立即连接。需要先注册事件时，将 autoConnect 设置为 false。
   */
  constructor(url: string, options: WebSocketWrapperOptions = {}) {
    this.url = url
    this.heartbeatData = options.heartbeatData ?? DEFAULT_HEARTBEAT_DATA
    this.heartbeatInterval = normalizeNumber(
      options.heartbeatInterval,
      DEFAULT_HEARTBEAT_INTERVAL,
    )
    this.heartbeatWhenHidden = options.heartbeatWhenHidden ?? true
    this.initialReconnectInterval = normalizePositiveNumber(
      options.reconnectInterval,
      DEFAULT_RECONNECT_INTERVAL,
    )
    this.logger = options.logger
    this.maxReconnectAttempts = normalizeReconnectAttempts(
      options.maxReconnectAttempts,
    )
    this.maxReconnectInterval = normalizePositiveNumber(
      options.maxReconnectInterval,
      DEFAULT_MAX_RECONNECT_INTERVAL,
    )
    this.reconnectInterval = this.initialReconnectInterval
    this.reconnectJitterRatio = normalizeNonNegativeNumber(
      options.reconnectJitterRatio,
      DEFAULT_RECONNECT_JITTER_RATIO,
    )
    this.shouldReconnect = options.shouldReconnect ?? (() => true)

    if (!this.heartbeatWhenHidden) {
      this.bindVisibilityChange()
    }

    if (options.autoConnect ?? true) {
      this.connect()
    }
  }

  /**
   * 当前连接状态。
   */
  get state() {
    return this.wrapperState
  }

  /**
   * 主动关闭连接。
   *
   * 调用后会停止心跳和自动重连；已注册的事件监听器会保留。
   */
  close(code?: number, reason?: string) {
    this.stopped = true
    this.clearReconnectTimer()
    this.stopHeartBeat()
    this.setState('closing')

    const socket = this.socket

    if (isActiveSocket(socket)) {
      socket.close(code, reason)
      return
    }

    this.socket = null
    this.setState('closed')
  }

  /**
   * 建立连接。
   *
   * 已处于 connecting/open 状态时会直接返回。
   */
  connect() {
    if (this.socket?.readyState === WebSocket.CONNECTING) return
    if (this.socket?.readyState === WebSocket.OPEN) return

    this.stopped = false
    this.clearReconnectTimer()
    this.setState('connecting')

    try {
      const socket = new WebSocket(this.url)

      this.socket = socket
      this.bindSocket(socket)
    } catch (error) {
      this.logger?.error?.('WebSocket 连接异常', error)
      this.socket = null
      this.setState('closed')
      this.reconnectAfterClose(createConnectionFailureCloseEvent())
    }
  }

  /**
   * 销毁实例。
   *
   * 会关闭连接、移除 visibilitychange 监听、清空所有事件监听器。
   */
  destroy(code?: number, reason?: string) {
    this.close(code, reason)
    this.unbindVisibilityChange()
    this.events.clear()
  }

  /**
   * 取消事件监听。
   */
  off<K extends keyof WebSocketWrapperEventMap>(
    type: K,
    listener: EventListener<WebSocketWrapperEventMap[K]>,
  ) {
    this.events.off(type, listener)
  }

  /**
   * 订阅事件，并返回取消订阅函数。
   *
   * @example
   * const off = socket.on('message', handleMessage)
   * off()
   */
  on<K extends keyof WebSocketWrapperEventMap>(
    type: K,
    listener: EventListener<WebSocketWrapperEventMap[K]>,
  ) {
    return this.events.on(type, listener)
  }

  /**
   * 订阅一次性事件，首次触发后自动取消订阅。
   */
  once<K extends keyof WebSocketWrapperEventMap>(
    type: K,
    listener: EventListener<WebSocketWrapperEventMap[K]>,
  ) {
    return this.events.once(type, listener)
  }

  /**
   * 发送 WebSocket 原生 payload。
   *
   * 连接未打开时返回 false，发送成功提交给 WebSocket 时返回 true。
   */
  send(data: WebSocketSendPayload) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false

    this.socket.send(data)
    return true
  }

  /**
   * 将数据 JSON 序列化后发送。
   *
   * 适合发送业务对象；无法 JSON 序列化的值会抛出 TypeError。
   */
  sendJson(value: unknown) {
    const payload = JSON.stringify(value)

    if (payload === undefined) {
      throw new TypeError('websocket payload must be JSON serializable')
    }

    return this.send(payload)
  }

  /**
   * 绑定当前 WebSocket 实例的原生事件。
   *
   * 每个回调都会校验 socket 引用，避免旧连接事件污染新连接状态。
   */
  private bindSocket(socket: WebSocket) {
    socket.addEventListener('open', (event) => {
      if (socket !== this.socket) return

      this.logger?.info?.('WebSocket 连接成功')
      this.reconnectAttempts = 0
      this.reconnectInterval = this.initialReconnectInterval
      this.setState('open')
      this.events.emit('open', event)
      this.startHeartBeat()
    })

    socket.addEventListener('close', (event) => {
      this.handleSocketClose(socket, event)
    })

    socket.addEventListener('error', (event) => {
      if (socket !== this.socket) return

      this.logger?.error?.('WebSocket 错误', event)
      this.events.emit('error', event)

      if (socket.readyState === WebSocket.CLOSED) {
        window.setTimeout(() => {
          if (
            socket === this.socket &&
            socket.readyState === WebSocket.CLOSED
          ) {
            this.handleSocketClose(socket, createConnectionFailureCloseEvent())
          }
        }, 0)
        return
      }

      if (socket.readyState !== WebSocket.CLOSING) {
        socket.close()
      }
    })

    socket.addEventListener('message', (event) => {
      if (socket !== this.socket) return

      this.events.emit('message', event)
    })
  }

  /**
   * 页面隐藏时暂停心跳，页面恢复时恢复心跳或补连。
   */
  private bindVisibilityChange() {
    if (typeof document === 'undefined') return

    this.visibilityListener = () => {
      if (document.hidden) {
        this.stopHeartBeat()
        return
      }

      if (this.socket?.readyState === WebSocket.OPEN) {
        this.startHeartBeat()
        return
      }

      if (!this.stopped) {
        this.connect()
      }
    }

    document.addEventListener('visibilitychange', this.visibilityListener)
  }

  /**
   * 清理待执行的重连定时器。
   */
  private clearReconnectTimer() {
    if (this.reconnectTimer === null) return

    window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  /**
   * 派发重连失败事件。
   */
  private emitReconnectFailed(reason: WebSocketReconnectFailedEvent['reason']) {
    this.events.emit('reconnectFailed', {
      attempts: this.reconnectAttempts,
      reason,
    })
  }

  /**
   * 读取本次心跳 payload。
   */
  private getHeartbeatData() {
    return typeof this.heartbeatData === 'function'
      ? this.heartbeatData()
      : this.heartbeatData
  }

  /**
   * 计算本次重连延迟。
   *
   * 延迟使用指数退避，并叠加 jitter 降低大量客户端同时重连的压力。
   */
  private getReconnectDelay() {
    const baseDelay = Math.min(
      this.reconnectInterval,
      this.maxReconnectInterval,
    )
    const jitter = baseDelay * this.reconnectJitterRatio * Math.random()

    return Math.round(baseDelay + jitter)
  }

  /**
   * 统一收口 socket 关闭状态。
   */
  private handleSocketClose(socket: WebSocket, event: CloseEvent) {
    if (socket !== this.socket) return

    this.logger?.info?.('WebSocket 连接断开', event)
    this.socket = null
    this.stopHeartBeat()
    this.events.emit('close', event)
    this.setState('closed')
    this.reconnectAfterClose(event)
  }

  /**
   * 根据关闭事件判断是否进入下一轮重连。
   */
  private reconnectAfterClose(event: CloseEvent) {
    if (this.stopped) return

    if (this.shouldReconnect(event)) {
      this.scheduleReconnect()
      return
    }

    this.emitReconnectFailed('reconnect-disabled')
  }

  /**
   * 安排下一次自动重连。
   */
  private scheduleReconnect() {
    if (this.stopped) return
    if (this.reconnectTimer !== null) return

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emitReconnectFailed('max-attempts')
      return
    }

    this.reconnectAttempts += 1
    this.setState('reconnecting')

    const delay = this.getReconnectDelay()
    const event: WebSocketReconnectEvent = {
      attempt: this.reconnectAttempts,
      delay,
      maxAttempts: this.maxReconnectAttempts,
    }

    this.logger?.debug?.('WebSocket 准备重连', event)
    this.events.emit('reconnect', event)

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null

      if (this.stopped) return

      this.reconnectInterval = Math.min(
        this.reconnectInterval * 2,
        this.maxReconnectInterval,
      )
      this.connect()
    }, delay)
  }

  /**
   * 更新内部状态并派发 stateChange。
   */
  private setState(current: WebSocketWrapperState) {
    if (this.wrapperState === current) return

    const previous = this.wrapperState
    const event: WebSocketStateChangeEvent = {
      current,
      previous,
    }

    this.wrapperState = current
    this.events.emit('stateChange', event)
  }

  /**
   * 启动心跳定时器。
   */
  private startHeartBeat() {
    this.stopHeartBeat()

    if (this.heartbeatInterval <= 0) {
      return
    }

    if (
      !this.heartbeatWhenHidden &&
      typeof document !== 'undefined' &&
      document.hidden
    ) {
      return
    }

    this.heartbeatTimer = window.setInterval(() => {
      try {
        this.send(this.getHeartbeatData())
      } catch (error) {
        this.logger?.error?.('WebSocket 心跳异常', error)
      }
    }, this.heartbeatInterval)
  }

  /**
   * 停止心跳定时器。
   */
  private stopHeartBeat() {
    if (this.heartbeatTimer === null) return

    window.clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  /**
   * 移除页面可见性监听。
   */
  private unbindVisibilityChange() {
    if (typeof document === 'undefined') return
    if (!this.visibilityListener) return

    document.removeEventListener('visibilitychange', this.visibilityListener)
    this.visibilityListener = null
  }
}

/**
 * 判断 socket 是否仍处于可主动关闭的状态。
 */
function isActiveSocket(socket: WebSocket | null): socket is WebSocket {
  return (
    socket?.readyState === WebSocket.CONNECTING ||
    socket?.readyState === WebSocket.OPEN
  )
}

/**
 * 创建连接失败时使用的关闭事件。
 */
function createConnectionFailureCloseEvent(): CloseEvent {
  if (typeof CloseEvent === 'function') {
    return new CloseEvent('close', {
      code: CONNECTION_FAILURE_CLOSE_CODE,
      reason: CONNECTION_FAILURE_CLOSE_REASON,
      wasClean: false,
    })
  }

  return {
    code: CONNECTION_FAILURE_CLOSE_CODE,
    reason: CONNECTION_FAILURE_CLOSE_REASON,
    wasClean: false,
  } as CloseEvent
}

/**
 * 归一化普通数值配置。
 */
function normalizeNumber(value: number | undefined, fallback: number) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

/**
 * 归一化非负数值配置。
 */
function normalizeNonNegativeNumber(
  value: number | undefined,
  fallback: number,
) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

/**
 * 归一化正数配置。
 */
function normalizePositiveNumber(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

/**
 * 归一化最大重连次数。
 */
function normalizeReconnectAttempts(value: number | undefined) {
  if (value === undefined) return DEFAULT_MAX_RECONNECT_ATTEMPTS
  if (value === Number.POSITIVE_INFINITY) return value
  if (!Number.isFinite(value) || value < 0)
    return DEFAULT_MAX_RECONNECT_ATTEMPTS

  return Math.floor(value)
}
