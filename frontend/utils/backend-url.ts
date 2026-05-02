export function normalizeBackendBaseUrl(baseUrl?: string): string {
  const raw = String(baseUrl || 'http://localhost:8080').trim()
  return raw.replace(/\/+$/, '')
}
