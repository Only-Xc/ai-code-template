import { HttpException, HttpStatus } from '@nestjs/common'
import { RESPONSE_ERROR_CODE } from './constants'

interface ResponseError {
  code: number
  message: string
}

export class ResponseException extends HttpException {
  constructor(err: ResponseError | string) {
    if (typeof err === 'string') {
      err = {
        code: RESPONSE_ERROR_CODE.COMMON,
        message: err,
      }
    }
    super(err, HttpStatus.OK)
  }
}
