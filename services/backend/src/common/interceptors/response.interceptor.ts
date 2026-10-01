import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { map, Observable } from 'rxjs'
import { RAW_RESPONSE } from '../http/raw-response.decorator'

export interface Response<T = unknown> {
  code: number
  message: string
  success: boolean
  data: T
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  private readonly reflector = new Reflector()

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T>> {
    // @RawResponse() 标记的 handler/class 直接输出原始响应（文件流、二进制等）
    if (
      this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return next.handle() as Observable<Response<T>>
    }

    return next.handle().pipe(
      map((data) => {
        return {
          code: 0,
          message: 'ok',
          success: true,
          data,
        }
      }),
    )
  }
}
