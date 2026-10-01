import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { LocalStorageAdapter } from './local-storage.adapter'

// localDirectory 默认相对进程 cwd，chdir 到临时目录实现隔离
describe('LocalStorageAdapter', () => {
  const originalCwd = process.cwd()
  let workDir: string
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'local-storage-'))
    process.chdir(workDir)
    adapter = new LocalStorageAdapter()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(workDir, { recursive: true, force: true })
  })

  it('put/get 往返一致，etag 为 SHA-256', async () => {
    const body = new TextEncoder().encode('hello')
    const put = await adapter.putObject({
      key: 'dir/a.txt',
      body,
      contentType: 'text/plain',
    })

    expect(put.sizeBytes).toBe(5)
    expect(put.etag).toBe(createHash('sha256').update(body).digest('hex'))

    const got = await adapter.getObject('dir/a.txt')
    expect(new TextDecoder().decode(got)).toBe('hello')
  })

  it('expectedSha256 不匹配时抛错', async () => {
    await adapter.putObject({
      key: 'a.txt',
      body: new TextEncoder().encode('x'),
    })
    await expect(
      adapter.getObject('a.txt', { expectedSha256: '0'.repeat(64) }),
    ).rejects.toThrow('digest did not match')
  })

  it('超过 maxBytes 时抛错', async () => {
    await adapter.putObject({
      key: 'a.txt',
      body: new TextEncoder().encode('x'),
    })
    await expect(adapter.getObject('a.txt', { maxBytes: 0 })).rejects.toThrow(
      'exceeded',
    )
  })

  it('拒绝目录逃逸的 key', async () => {
    await expect(
      adapter.putObject({
        key: '../escape.txt',
        body: new TextEncoder().encode('x'),
      }),
    ).rejects.toThrow('escapes the local root')
  })

  it('presigned URL 明确不支持', async () => {
    await expect(adapter.createPresignedGetUrl('a', 60)).rejects.toThrow(
      'does not support presigned',
    )
  })

  it('head/objectExists/delete 生命周期', async () => {
    const key = `${randomUUID()}.bin`
    expect(await adapter.objectExists(key)).toBe(false)

    await adapter.putObject({ key, body: new Uint8Array([1, 2, 3]) })
    expect(await adapter.objectExists(key)).toBe(true)
    expect((await adapter.headObject(key)).sizeBytes).toBe(3)

    await adapter.deleteObject(key)
    expect(await adapter.objectExists(key)).toBe(false)
  })

  it('流式 put 校验 contentLength（不匹配拒绝写入）', async () => {
    await expect(
      adapter.putObject({
        key: 'stream.bin',
        body: Readable.from([Buffer.from('abcd')]),
        contentLength: 3,
      }),
    ).rejects.toThrow('Local object storage write failed')
    expect(await adapter.objectExists('stream.bin')).toBe(false)
  })
})
