import { SetMetadata } from '@nestjs/common'

export const RAW_RESPONSE = 'template:raw-response'

/** 标记 handler/class 直接输出原始响应（文件流、二进制等），跳过统一响应信封。 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true)
