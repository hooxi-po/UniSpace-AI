declare global {
  interface Window {
    mars3d?: unknown
  }
}

let mars3dLoadingPromise: Promise<unknown> | null = null

export async function loadMars3D() {
  if (typeof window === 'undefined') {
    throw new Error('mars3d_load_requires_browser')
  }
  if (window.mars3d) return window.mars3d

  if (!mars3dLoadingPromise) {
    mars3dLoadingPromise = (async () => {
      try {
        await import('mars3d/mars3d.css')
        const mod = await import('mars3d')
        const candidate = ((mod as any).default && (mod as any).default.Map)
          ? (mod as any).default
          : mod
        if (!candidate || typeof candidate.Map !== 'function') {
          throw new Error('mars3d_not_available')
        }
        window.mars3d = candidate
        return candidate
      } catch (error) {
        // Allow retries after transient chunk/css load errors.
        mars3dLoadingPromise = null
        throw error
      }
    })()
  }

  return mars3dLoadingPromise
}
