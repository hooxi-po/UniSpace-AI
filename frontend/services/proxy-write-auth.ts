const WRITE_PROXY_AUTH_ERRORS = new Set([
  'proxy_write_auth_required',
  'proxy_write_auth_forbidden',
])
export const PROXY_WRITE_AUTH_REQUEST_EVENT = 'proxy-write-auth:request'

let cachedAuthorization: string | null = null
let pendingAuthorizationPromise: Promise<string | null> | null = null
let pendingAuthorizationResolver: ((authorization: string | null) => void) | null = null

function withAuthorization(init: RequestInit | undefined, authorization: string | null): RequestInit {
  if (!authorization) {
    return { ...(init || {}) }
  }

  const headers = new Headers(init?.headers || {})
  headers.set('Authorization', authorization)
  return {
    ...(init || {}),
    headers,
  }
}

async function readProxyErrorCode(response: Response) {
  try {
    const body = await response.json()
    if (!body || typeof body !== 'object') {
      return ''
    }

    if (typeof body.error === 'string') {
      return body.error
    }

    if (typeof body.statusMessage === 'string') {
      return body.statusMessage
    }

    if (typeof body.message === 'string') {
      return body.message
    }

    if (body.data && typeof body.data === 'object' && typeof body.data.error === 'string') {
      return body.data.error
    }
  } catch {
    // noop
  }
  return ''
}

function encodeBasicToken(username: string, password: string) {
  if (typeof btoa === 'function') {
    return btoa(`${username}:${password}`)
  }
  return Buffer.from(`${username}:${password}`).toString('base64')
}

function resolvePendingAuthorization(authorization: string | null) {
  if (!pendingAuthorizationResolver) {
    pendingAuthorizationPromise = null
    return
  }
  pendingAuthorizationResolver(authorization)
  pendingAuthorizationResolver = null
  pendingAuthorizationPromise = null
}

function requestAuthorizationHeader() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (pendingAuthorizationPromise) return pendingAuthorizationPromise

  pendingAuthorizationPromise = new Promise((resolve) => {
    pendingAuthorizationResolver = resolve
    window.dispatchEvent(new CustomEvent(PROXY_WRITE_AUTH_REQUEST_EVENT))
  })
  return pendingAuthorizationPromise
}

export function submitProxyWriteAuthorization(username: string, password: string) {
  const token = encodeBasicToken(username, password)
  resolvePendingAuthorization(`Basic ${token}`)
}

export function cancelProxyWriteAuthorization() {
  resolvePendingAuthorization(null)
}

export function clearCachedProxyWriteAuthorization() {
  cachedAuthorization = null
}

function shouldPromptForAuth(response: Response, errorCode: string) {
  if (response.status !== 401 && response.status !== 403) return false
  if (WRITE_PROXY_AUTH_ERRORS.has(errorCode)) return true
  return false
}

export async function fetchWithProxyWriteAuth(url: string, init?: RequestInit) {
  let response = await fetch(url, withAuthorization(init, cachedAuthorization))
  if (response.ok) {
    return response
  }

  const errorCode = await readProxyErrorCode(response.clone())
  if (!shouldPromptForAuth(response, errorCode)) {
    return response
  }

  if (response.status === 403) {
    cachedAuthorization = null
  }

  const promptedAuthorization = await requestAuthorizationHeader()
  if (!promptedAuthorization) {
    return response
  }

  response = await fetch(url, withAuthorization(init, promptedAuthorization))
  if (response.ok) {
    cachedAuthorization = promptedAuthorization
    return response
  }

  const retryErrorCode = await readProxyErrorCode(response.clone())
  if (response.status === 403 && shouldPromptForAuth(response, retryErrorCode)) {
    cachedAuthorization = null
  }

  return response
}
