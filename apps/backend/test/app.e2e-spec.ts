import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, VersioningType } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'

describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI })
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('/api/health (GET)', () => {
    return request(app.getHttpServer()).get('/api/health').expect(200)
  })

  it('auth flow: signup → login → test-token → refresh → logout', async () => {
    const email = `e2e-${Date.now()}@example.com`
    const password = 'password123'

    // 注册
    const signup = await request(app.getHttpServer())
      .post('/api/v1/users/signup')
      .send({ email, password })
      .expect(200)
    expect(signup.body.data.email).toBe(email)
    expect(signup.body.data.is_active).toBe(true)

    // 登录（OAuth2 表单；唯一 X-Forwarded-For 避免限流计数器跨运行累积）
    const login = await request(app.getHttpServer())
      .post('/api/v1/login/access-token')
      .type('form')
      .set('X-Forwarded-For', `10.0.${Date.now() % 200}.1`)
      .send({ username: email, password })
      .expect(200)
    const accessToken = login.body.data.access_token
    const refreshToken = login.body.data.refresh_token
    expect(accessToken).toBeTruthy()
    expect(refreshToken).toBeTruthy()
    expect(login.body.data.token_type).toBe('bearer')

    // test-token（Bearer 校验返回当前用户）
    const me = await request(app.getHttpServer())
      .post('/api/v1/login/test-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
    expect(me.body.data.email).toBe(email)

    // 刷新旋转
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/login/refresh-token')
      .send({ refresh_token: refreshToken })
      .expect(200)
    expect(refreshed.body.data.access_token).toBeTruthy()
    expect(refreshed.body.data.refresh_token).not.toBe(refreshToken)

    // 登出
    await request(app.getHttpServer())
      .post('/api/v1/logout')
      .send({ refresh_token: refreshToken })
      .expect(200)

    // 登出后旧 refresh token 失效
    await request(app.getHttpServer())
      .post('/api/v1/login/refresh-token')
      .send({ refresh_token: refreshToken })
      .expect(401)
  })
})
