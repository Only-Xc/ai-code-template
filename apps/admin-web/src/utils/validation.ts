/** 刻意宽松：地址合法性由账号存储而非输入框负责。 */
export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value)
}
