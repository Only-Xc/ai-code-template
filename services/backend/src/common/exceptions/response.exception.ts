import { HttpException, HttpStatus } from '@nestjs/common'
import { RESPONSE_ERROR_CODE } from './constants'

interface ResponseError {
  code: number
  message: string
}

interface ResponseExceptionOptions {
  readonly cause?: unknown
  readonly details?: Readonly<Record<string, unknown>>
}

export class ResponseException extends HttpException {
  readonly code: number
  readonly details?: Readonly<Record<string, unknown>>

  constructor(err: ResponseError | string, options?: ResponseExceptionOptions) {
    if (typeof err === 'string') {
      err = {
        code: RESPONSE_ERROR_CODE.COMMON,
        message: err,
      }
    }
    super({ code: err.code, message: err.message }, HttpStatus.OK, {
      cause: options?.cause,
    })
    this.code = err.code
    this.details = options?.details
  }
}
