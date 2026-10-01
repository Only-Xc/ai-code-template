import { AsyncLocalStorage } from 'node:async_hooks'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from 'generated/prisma/client'
import type { Prisma } from 'generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { configuration } from 'src/config'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly transactionContext =
    new AsyncLocalStorage<Prisma.TransactionClient>()

  constructor() {
    const url = configuration('database.url')
    const pool = new Pool({ connectionString: url, options: '-c timezone=UTC' })
    // 外部创建的 Pool 需显式声明由 adapter 释放，否则 $disconnect 后连接池泄漏
    const adapter = new PrismaPg(pool, { disposeExternalPool: true })
    super({ adapter })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  /** 返回当前活跃的事务客户端，若无事务则返回根 Prisma 客户端。 */
  db(): Prisma.TransactionClient | PrismaService {
    return this.transactionContext.getStore() ?? this
  }

  /** 在事务中执行 work；嵌套调用复用外层事务，不会在异步请求之间泄漏客户端。 */
  async transaction<Result>(work: () => Promise<Result>): Promise<Result> {
    if (this.transactionContext.getStore()) return work()
    return this.$transaction((client) =>
      this.transactionContext.run(client, work),
    )
  }
}
