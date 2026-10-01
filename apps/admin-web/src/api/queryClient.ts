import { QueryClient } from '@tanstack/react-query'

/** 应用级 QueryClient 单例：失效层与组件共用同一实例。 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
