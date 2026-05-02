import type { H3Event } from 'h3'
import { getRequestHeader, setResponseHeader } from 'h3'
import { timingSafeEqual } from 'node:crypto'

function parseBoolean(value: unknown, defaultValue: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return defaultValue
  const normalized = value.trim().toLowerCase()
  if (!normalized) return defaultValue
  return !['0', 'false', 'off', 'no'].includes(normalized)
}

function timingSafeEqualString(a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return timingSafeEqual(aBuffer, bBuffer)
}

function parseBasicAuthorization(authHeader: string | undefined) {
  if (!authHeader) return null
  if (!authHeader.toLowerCase().startsWith('basic ')) return null
  const token = authHeader.slice(6).trim()
  if (!token) return null
  let decoded = ''
  try {
    decoded = Buffer.from(token, 'base64').toString('utf8')
  } catch {
    return null
  }
  const separatorIndex = decoded.indexOf(':')
  if (separatorIndex < 0) return null
  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  }
}

export function assertProxyWriteCallerAuthorized(event: H3Event) {
  const config = useRuntimeConfig()
  const writeAuthEnabled = parseBoolean(config.backendWriteAuthEnabled, true)
  if (!writeAuthEnabled) return

  const expectedUsername = String(config.backendAdminUser || '').trim()
  const expectedPassword = String(config.backendAdminPassword || '').trim()
  if (!expectedUsername || !expectedPassword) {
    throw createError({ statusCode: 500, statusMessage: 'backend_write_auth_not_configured' })
  }

  const auth = parseBasicAuthorization(getRequestHeader(event, 'authorization'))
  if (!auth) {
    setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="UniSpace Backend Write Proxy"')
    throw createError({
      statusCode: 401,
      statusMessage: 'proxy_write_auth_required',
    })
  }

  const validUsername = timingSafeEqualString(auth.username, expectedUsername)
  const validPassword = timingSafeEqualString(auth.password, expectedPassword)
  if (!validUsername || !validPassword) {
    throw createError({
      statusCode: 403,
      statusMessage: 'proxy_write_auth_forbidden',
    })
  }
}

export function getBackendBaseUrl() {
  const config = useRuntimeConfig()
  const backendBaseUrl = String(config.public.backendBaseUrl || '').trim()
  if (!backendBaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'backend_base_url_missing' })
  }
  return backendBaseUrl
}

export function getBackendWriteAuthHeader(): Record<string, string> {
  const config = useRuntimeConfig()
  const writeAuthEnabled = parseBoolean(config.backendWriteAuthEnabled, true)
  if (!writeAuthEnabled) {
    return {}
  }

  const username = String(config.backendAdminUser || '').trim()
  const password = String(config.backendAdminPassword || '').trim()
  if (!username || !password) {
    throw createError({ statusCode: 500, statusMessage: 'backend_write_auth_not_configured' })
  }
  const token = Buffer.from(`${username}:${password}`).toString('base64')
  return { Authorization: `Basic ${token}` }
}

export function toProxyError(event: H3Event, error: unknown) {
  const statusCode = (error as any)?.statusCode || (error as any)?.response?.status || 502
  const statusMessage = (error as any)?.statusMessage
    || (error as any)?.data?.error
    || (error as any)?.data?.message
    || 'backend_proxy_error'
  const errorCode = String((error as any)?.data?.error || statusMessage || 'backend_proxy_error')

  return createError({
    statusCode,
    statusMessage,
    data: {
      error: errorCode,
      requestId: event.node.res.getHeader('X-Request-Id') || null,
    },
  })
}
