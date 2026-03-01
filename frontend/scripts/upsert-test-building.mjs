import { promises as fs } from 'node:fs'
import path from 'node:path'

const DEFAULT_BASE_URL = 'http://localhost:8080'
const TEST_BUILDING_NAME = '测试建筑1'
const TEST_BUILDING_ID = 'building_test_1'

function parseEnvText(text) {
  const env = {}
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function loadDotEnv(cwd) {
  const envPath = path.join(cwd, '.env')
  try {
    const raw = await fs.readFile(envPath, 'utf8')
    return parseEnvText(raw)
  } catch {
    return {}
  }
}

function boolFromEnv(raw, defaultValue) {
  if (raw == null || raw === '') return defaultValue
  const v = String(raw).trim().toLowerCase()
  if (!v) return defaultValue
  return !['0', 'false', 'off', 'no'].includes(v)
}

function buildAuthHeader(username, password) {
  if (!username || !password) return {}
  const token = Buffer.from(`${username}:${password}`).toString('base64')
  return { Authorization: `Basic ${token}` }
}

async function requestJson(url, init = {}) {
  const res = await fetch(url, init)
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const err = (json && (json.error || json.message)) || text || `HTTP ${res.status}`
    throw new Error(String(err))
  }
  return json
}

function buildTestBuildingPayload(id) {
  return {
    id,
    layer: 'buildings',
    visible: true,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [119.18970, 26.02518],
        [119.18986, 26.02518],
        [119.18986, 26.02530],
        [119.18970, 26.02530],
        [119.18970, 26.02518],
      ]],
    },
    properties: {
      name: TEST_BUILDING_NAME,
      short_name: TEST_BUILDING_NAME,
      building: 'office',
      amenity: 'office',
      'building:levels': 6,
      visible: true,
      modelEnabled: true,
      modelUrl: '/models/officeBuild.glb',
      modelHeading: 0,
      modelPitch: 0,
      modelRoll: 0,
      modelScaleMode: 'auto',
    },
  }
}

async function main() {
  const cwd = process.cwd()
  const fileEnv = await loadDotEnv(cwd)

  const baseUrl = (
    process.env.NUXT_PUBLIC_BACKEND_BASE_URL
    || process.env.BACKEND_BASE_URL
    || fileEnv.NUXT_PUBLIC_BACKEND_BASE_URL
    || DEFAULT_BASE_URL
  ).replace(/\/+$/, '')

  const writeAuthEnabled = boolFromEnv(
    process.env.BACKEND_WRITE_AUTH_ENABLED
      || process.env.APP_SECURITY_WRITE_AUTH_ENABLED
      || fileEnv.BACKEND_WRITE_AUTH_ENABLED,
    true,
  )

  const adminUser = (
    process.env.BACKEND_ADMIN_USER
    || process.env.APP_ADMIN_USER
    || fileEnv.BACKEND_ADMIN_USER
    || 'admin'
  ).trim()
  const adminPassword = (
    process.env.BACKEND_ADMIN_PASSWORD
    || process.env.APP_ADMIN_PASSWORD
    || fileEnv.BACKEND_ADMIN_PASSWORD
    || ''
  ).trim()

  const writeHeaders = {
    'Content-Type': 'application/json',
    ...(writeAuthEnabled ? buildAuthHeader(adminUser, adminPassword) : {}),
  }

  const listUrl = `${baseUrl}/api/v1/features?layers=buildings&limit=5000`
  const collection = await requestJson(listUrl)
  const features = Array.isArray(collection?.features) ? collection.features : []

  const existingByName = features.find(
    (f) => String(f?.properties?.name || '') === TEST_BUILDING_NAME,
  )
  const targetId = String(existingByName?.id || TEST_BUILDING_ID)
  const payload = buildTestBuildingPayload(targetId)

  if (existingByName) {
    await requestJson(`${baseUrl}/api/v1/features`, {
      method: 'PUT',
      headers: writeHeaders,
      body: JSON.stringify(payload),
    })
    console.log(`[seed:test-building] updated: ${targetId}`)
  } else {
    await requestJson(`${baseUrl}/api/v1/features`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify(payload),
    })
    console.log(`[seed:test-building] created: ${targetId}`)
  }
}

main().catch((error) => {
  console.error('[seed:test-building] failed:', error?.message || error)
  process.exitCode = 1
})
