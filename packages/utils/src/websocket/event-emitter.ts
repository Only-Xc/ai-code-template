import mitt from 'mitt'
import type { Emitter, EventType, Handler } from 'mitt'

export type EventListener<TEvent> = (event: TEvent) => void

/**
 * 基于 mitt 的类型安全事件封装。
 *
 * 业务侧通常直接使用 WebSocketWrapper.on/off/once，无需直接实例化该类。
 */
export class EventEmitter<TEventMap extends object> {
  /**
   * mitt 实例，负责实际的事件存储和分发。
   */
  private readonly emitter: Emitter<Record<EventType, unknown>> = mitt()

  /**
   * 清空指定事件的监听器；不传 type 时清空所有监听器。
   */
  clear<K extends keyof TEventMap>(type?: K) {
    if (type === undefined) {
      this.emitter.all.clear()
      return
    }

    this.emitter.all.delete(type as EventType)
  }

  /**
   * 触发指定事件。
   */
  emit<K extends keyof TEventMap & EventType>(type: K, event: TEventMap[K]) {
    this.emitter.emit(type, event)
  }

  /**
   * 移除指定事件监听器。
   */
  off<K extends keyof TEventMap & EventType>(
    type: K,
    listener: EventListener<TEventMap[K]>,
  ) {
    this.emitter.off(type, listener as Handler<unknown>)
  }

  /**
   * 订阅事件，并返回取消订阅函数。
   */
  on<K extends keyof TEventMap & EventType>(
    type: K,
    listener: EventListener<TEventMap[K]>,
  ) {
    this.emitter.on(type, listener as Handler<unknown>)

    return () => this.off(type, listener)
  }

  /**
   * 订阅一次性事件，首次触发后自动取消订阅。
   */
  once<K extends keyof TEventMap & EventType>(
    type: K,
    listener: EventListener<TEventMap[K]>,
  ) {
    const off = this.on(type, (event) => {
      off()
      listener(event)
    })

    return off
  }
}
