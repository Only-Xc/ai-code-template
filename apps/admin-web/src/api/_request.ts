import { createApiCaller } from '@ai-app/api'

import { requestClient } from '@/utils/request'

export const request = createApiCaller(requestClient)
