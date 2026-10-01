import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { redact } from '../logging/redactor'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    // request.log 是 Fastify 挂在请求对象上的日志能力；脱敏后再写入，避免泄漏敏感字段
    request.log.error(redact(exception))

    // 把“非 HTTP 标准异常”统一映射成 503。
    response.status(HttpStatus.SERVICE_UNAVAILABLE).send({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: new ServiceUnavailableException().getResponse(), // 返回更友好的标准错误信息，而不是直接暴露底层异常细节
    })
  }
}
