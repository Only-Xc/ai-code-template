import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ResponseException } from '../exceptions/response.exception'

@Catch(HttpException)
export class HttpExceptionsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()
    const status = exception.getStatus()
    const error = exception.getResponse()

    // 处理业务异常
    if (exception instanceof ResponseException) {
      const { code, message } = error as {
        code: number
        message: string
      }

      response.status(HttpStatus.OK).send({
        code,
        message,
        success: false,
        data: null,
      })
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
