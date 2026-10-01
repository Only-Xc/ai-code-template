/** 触发浏览器下载并在事后释放 object URL（同一行为单元有释放路径）。 */
export function downloadBlob(
  data: Blob | ArrayBuffer,
  filename: string,
  mimeType?: string,
): void {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mimeType })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = href
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}
