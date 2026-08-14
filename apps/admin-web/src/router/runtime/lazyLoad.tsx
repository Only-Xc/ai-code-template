import { lazy } from 'react'
import type { ComponentType, ReactElement } from 'react'

interface LazyModule {
  default: ComponentType
}

const routeChunkLoadingListeners = new Set<() => void>()

let pendingRouteChunkLoads = 0

function updateRouteChunkLoading(delta: number) {
  pendingRouteChunkLoads = Math.max(0, pendingRouteChunkLoads + delta)
  routeChunkLoadingListeners.forEach((listener) => {
    listener()
  })
}

export function getRouteChunkLoadingSnapshot() {
  return pendingRouteChunkLoads > 0
}

export function subscribeRouteChunkLoading(listener: () => void) {
  routeChunkLoadingListeners.add(listener)

  return () => {
    routeChunkLoadingListeners.delete(listener)
  }
}

export function lazyLoad(loader: () => Promise<LazyModule>): ReactElement {
  const Component = lazy(() => {
    updateRouteChunkLoading(1)

    return loader().finally(() => {
      updateRouteChunkLoading(-1)
    })
  })

  return <Component />
}
