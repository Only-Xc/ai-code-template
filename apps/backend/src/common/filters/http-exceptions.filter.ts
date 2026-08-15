import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ResponseException } from '../exceptions/response.exception'
import { Response } from '../interceptors/response.interceptor'

@Catch(HttpException)
export class HttpExceptionsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()
    let status = exception.getStatus()
    let error = exception.getResponse()

    // 处理业务异常
    if (exception instanceof ResponseException) {
      response.status(HttpStatus.OK).send({
        code: error['code'],
        message: error['message'],
        success: false,
        data: null,
      } as Response)
      return
    }

    // 其它异常处理
    response.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: error,
    })
  }
}
