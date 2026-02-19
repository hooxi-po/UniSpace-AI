import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const NUXT_DIR = path.join(ROOT, '.nuxt')
const MANIFEST_META_DIR = path.join(NUXT_DIR, 'manifest', 'meta')
const MANIFEST_DEV_PATH = path.join(MANIFEST_META_DIR, 'dev.json')
const DIST_SERVER_DIR = path.join(NUXT_DIR, 'dist', 'server')
const INTERNAL_DIR = path.join(DIST_SERVER_DIR, 'internal', 'nuxt')
const INTERNAL_PATHS_FILE = path.join(INTERNAL_DIR, 'paths.mjs')
const DIST_PACKAGE_JSON = path.join(DIST_SERVER_DIR, 'package.json')

async function pathExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

const pathsSource = `import { joinRelativeURL } from 'ufo'\n\nconst getAppConfig = () => ({ baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' })\n\nexport const baseURL = () => getAppConfig().baseURL\nexport const buildAssetsDir = () => getAppConfig().buildAssetsDir\nexport const publicAssetsURL = (...path) => {\n  const appConfig = getAppConfig()\n  const publicBase = appConfig.cdnURL || appConfig.baseURL\n  return path.length ? joinRelativeURL(publicBase, ...path) : publicBase\n}\nexport const buildAssetsURL = (...path) => joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path)\n\nif (typeof globalThis !== 'undefined') {\n  globalThis.__buildAssetsURL = buildAssetsURL\n  globalThis.__publicAssetsURL = publicAssetsURL\n}\n`
const manifestFallback = JSON.stringify(
  {
    id: 'dev',
    timestamp: Date.now(),
    matcher: { static: {}, wildcard: {}, dynamic: {} },
    prerendered: [],
  },
  null,
  0,
)

async function ensureManifestFallback() {
  await ensureDir(MANIFEST_META_DIR)
  if (!(await pathExists(MANIFEST_DEV_PATH))) {
    await fs.writeFile(MANIFEST_DEV_PATH, manifestFallback, 'utf8')
  }
}

function isLegacyPlaceholderPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return false
  if (pkg.name !== 'nuxt-dist-server-internal') return false
  const imports = pkg.imports && typeof pkg.imports === 'object' ? pkg.imports : {}
  const keys = Object.keys(imports)
  return keys.length <= 1 && imports['#internal/nuxt/paths'] === './internal/nuxt/paths.mjs'
}

async function removeLegacyPlaceholder() {
  if (!(await pathExists(DIST_PACKAGE_JSON))) return false

  try {
    const raw = await fs.readFile(DIST_PACKAGE_JSON, 'utf8')
    const pkg = JSON.parse(raw)
    if (!isLegacyPlaceholderPackage(pkg)) return false

    await fs.rm(DIST_SERVER_DIR, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

async function patchExistingDistPackageJson() {
  if (!(await pathExists(DIST_PACKAGE_JSON))) return false

  const raw = await fs.readFile(DIST_PACKAGE_JSON, 'utf8')
  const parsed = JSON.parse(raw)
  const pkg = {
    ...parsed,
    type: parsed.type || 'module',
    imports: {
      ...(parsed.imports || {}),
      '#internal/nuxt/paths': './internal/nuxt/paths.mjs',
    },
  }
  await ensureDir(INTERNAL_DIR)
  await fs.writeFile(INTERNAL_PATHS_FILE, pathsSource, 'utf8')
  await fs.writeFile(DIST_PACKAGE_JSON, JSON.stringify(pkg, null, 2), 'utf8')
  return true
}

const removedLegacy = await removeLegacyPlaceholder()
const patched = await patchExistingDistPackageJson()
await ensureManifestFallback()

if (patched) {
  console.log('[ensure-nuxt-internal] patched .nuxt/dist/server internal aliases')
} else if (removedLegacy) {
  console.log('[ensure-nuxt-internal] removed legacy placeholder .nuxt/dist/server/package.json')
} else {
  console.log('[ensure-nuxt-internal] skipped (Nuxt dist/server package not generated yet)')
}
