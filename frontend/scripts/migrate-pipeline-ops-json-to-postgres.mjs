import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

function boolFromEnv(raw, defaultValue) {
  if (raw == null || raw === '') return defaultValue
  const normalized = String(raw).trim().toLowerCase()
  if (!normalized) return defaultValue
  return !['0', 'false', 'off', 'no'].includes(normalized)
}

async function loadDotEnv() {
  try {
    const raw = await readFile(path.resolve(__dirname, '../.env'), 'utf8')
    return parseEnvText(raw)
  } catch {
    return {}
  }
}

function buildAuthHeader(username, password) {
  if (!username || !password) return ''
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

const sourceFile = path.resolve(__dirname, '../server/data/pipeline-ops.json')

function toPayload(order) {
  return {
    id: order.id,
    title: order.title,
    description: order.description,
    type: order.type,
    source: order.source,
    status: order.status,
    pipelineMedium: order.pipelineMedium,
    priority: order.priority,
    area: order.area,
    topologyChain: Array.isArray(order.topologyChain) ? order.topologyChain : [],
    nodeIds: Array.isArray(order.nodeIds) ? order.nodeIds : [],
    segmentIds: Array.isArray(order.segmentIds) ? order.segmentIds : [],
    buildingId: order.buildingId,
    buildingName: order.buildingName,
    roomIds: Array.isArray(order.roomIds) ? order.roomIds : [],
    equipmentIds: Array.isArray(order.equipmentIds) ? order.equipmentIds : [],
    assignee: order.assignee,
    reviewer: order.reviewer,
    plannedDate: order.plannedDate,
    deadlineAt: order.deadlineAt,
    startedAt: order.startedAt,
    reviewedAt: order.reviewedAt,
    finishedAt: order.finishedAt,
    closedAt: order.closedAt,
    resultSummary: order.resultSummary,
    linkedWorkorderIds: Array.isArray(order.linkedWorkorderIds) ? order.linkedWorkorderIds : [],
    impactScope: order.impactScope,
    pumpControls: Array.isArray(order.pumpControls) ? order.pumpControls : [],
    executionLogs: Array.isArray(order.executionLogs) ? order.executionLogs : [],
    inspection: order.inspection || null,
    maintenance: order.maintenance || null,
    retrofit: order.retrofit || null,
    retire: order.retire || null,
    notifications: Array.isArray(order.notifications) ? order.notifications : [],
    createdBy: order.createdBy,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

async function postWorkorder(payload, backendBaseUrl, authHeader) {
  const headers = {
    'Content-Type': 'application/json',
  }
  if (authHeader) {
    headers.Authorization = authHeader
  }
  const res = await fetch(`${backendBaseUrl}/api/v1/pipeline-ops/workorders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`)
  }
  return await res.json()
}

async function main() {
  const fileEnv = await loadDotEnv()
  const backendBaseUrl = String(
    process.env.BACKEND_BASE_URL
      || process.env.NUXT_PUBLIC_BACKEND_BASE_URL
      || fileEnv.BACKEND_BASE_URL
      || fileEnv.NUXT_PUBLIC_BACKEND_BASE_URL
      || 'http://localhost:8080',
  ).replace(/\/$/, '')
  const writeAuthEnabled = boolFromEnv(
    process.env.BACKEND_WRITE_AUTH_ENABLED
      || process.env.APP_SECURITY_WRITE_AUTH_ENABLED
      || fileEnv.BACKEND_WRITE_AUTH_ENABLED,
    true,
  )
  const adminUser = String(
    process.env.BACKEND_ADMIN_USER
      || process.env.APP_ADMIN_USER
      || fileEnv.BACKEND_ADMIN_USER
      || 'admin',
  ).trim()
  const adminPassword = String(
    process.env.BACKEND_ADMIN_PASSWORD
      || process.env.APP_ADMIN_PASSWORD
      || fileEnv.BACKEND_ADMIN_PASSWORD
      || '',
  ).trim()

  if (writeAuthEnabled && !adminPassword) {
    console.error('[migrate:pipeline-ops] missing BACKEND_ADMIN_PASSWORD / APP_ADMIN_PASSWORD')
    process.exit(1)
  }

  const authHeader = writeAuthEnabled ? buildAuthHeader(adminUser, adminPassword) : ''
  const raw = await readFile(sourceFile, 'utf-8')
  const parsed = JSON.parse(raw)
  const orders = Array.isArray(parsed?.workorders) ? parsed.workorders : []

  if (!orders.length) {
    console.log('[migrate:pipeline-ops] no workorders found in json, skip')
    return
  }

  let success = 0
  let failed = 0
  for (const [index, order] of orders.entries()) {
    const label = String(order?.id || `#${index + 1}`)
    try {
      await postWorkorder(toPayload(order || {}), backendBaseUrl, authHeader)
      success += 1
      console.log(`[migrate:pipeline-ops] imported ${label}`)
    } catch (error) {
      failed += 1
      console.error(`[migrate:pipeline-ops] failed ${label}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`[migrate:pipeline-ops] done success=${success} failed=${failed}`)
  if (failed > 0) process.exit(2)
}

main().catch((error) => {
  console.error('[migrate:pipeline-ops] fatal:', error)
  process.exit(1)
})
