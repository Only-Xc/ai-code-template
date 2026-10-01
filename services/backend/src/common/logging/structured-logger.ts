import { Logger } from '@nestjs/common'

import { redact } from './redactor'

export type StructuredLogFields = Readonly<Record<string, unknown>>

/** 将日志事件与字段统一转换为已脱敏的结构化对象后输出。 */
export class StructuredLogger {
  private readonly logger: Logger

  constructor(context: string) {
    this.logger = new Logger(context)
  }

  log(event: string, fields: StructuredLogFields = {}): void {
    this.logger.log(redact({ ...fields, event }))
  }

  warn(event: string, fields: StructuredLogFields = {}): void {
    this.logger.warn(redact({ ...fields, event }))
  }

  error(
    event: string,
    error?: unknown,
    fields: StructuredLogFields = {},
  ): void {
    this.logger.error(redact({ ...fields, event, error }))
  }
}
