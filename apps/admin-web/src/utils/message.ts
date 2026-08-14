import { useEffect } from 'react'
import { App as AntdApp } from 'antd'
import type { MessageInstance } from 'antd/es/message/interface'
import type { NotificationInstance } from 'antd/es/notification/interface'

let _messageApi: MessageInstance | null = null
let _notificationApi: NotificationInstance | null = null

export function GlobalMessageRegister() {
  const { message, notification } = AntdApp.useApp()

  useEffect(() => {
    _messageApi = message
    _notificationApi = notification

    return () => {
      if (_messageApi === message) {
        _messageApi = null
      }
      if (_notificationApi === notification) {
        _notificationApi = null
      }
    }
  }, [message, notification])

  return null
}

export const globalMessage = {
  info(msg: string) {
    void _messageApi?.info(msg)
  },
  success(msg: string) {
    void _messageApi?.success(msg)
  },
  warning(msg: string) {
    void _messageApi?.warning(msg)
  },
  error(msg: string) {
    void _messageApi?.error(msg)
  },
}

export const globalNotification = {
  info(options: Parameters<NotificationInstance['info']>[0]) {
    _notificationApi?.info(options)
  },
  success(options: Parameters<NotificationInstance['success']>[0]) {
    _notificationApi?.success(options)
  },
  warning(options: Parameters<NotificationInstance['warning']>[0]) {
    _notificationApi?.warning(options)
  },
  error(options: Parameters<NotificationInstance['error']>[0]) {
    _notificationApi?.error(options)
  },
}
