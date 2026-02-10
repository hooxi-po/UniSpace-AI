import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const NUXT_DIR = path.join(ROOT, '.nuxt')
const DIST_SERVER_DIR = path.join(NUXT_DIR, 'dist', 'server')
const INTERNAL_DIR = path.join(DIST_SERVER_DIR, 'internal', 'nuxt')
const INTERNAL_PATHS_FILE = path.join(INTERNAL_DIR, 'paths.mjs')
const DIST_PACKAGE_JSON = path.join(DIST_SERVER_DIR, 'package.json')

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

const pathsSource = `import { joinRelativeURL } from 'ufo'\n\nconst getAppConfig = () => ({ baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' })\n\nexport const baseURL = () => getAppConfig().baseURL\nexport const buildAssetsDir = () => getAppConfig().buildAssetsDir\nexport const publicAssetsURL = (...path) => {\n  const appConfig = getAppConfig()\n  const publicBase = appConfig.cdnURL || appConfig.baseURL\n  return path.length ? joinRelativeURL(publicBase, ...path) : publicBase\n}\nexport const buildAssetsURL = (...path) => joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path)\n\nif (typeof globalThis !== 'undefined') {\n  globalThis.__buildAssetsURL = buildAssetsURL\n  globalThis.__publicAssetsURL = publicAssetsURL\n}\n`

async function ensurePathsFile() {
  await ensureDir(INTERNAL_DIR)
  await fs.writeFile(INTERNAL_PATHS_FILE, pathsSource, 'utf8')
}

async function ensureDistPackageJson() {
  await ensureDir(DIST_SERVER_DIR)

  let pkg = {
    name: 'nuxt-dist-server-internal',
    private: true,
    type: 'module',
    imports: {
      '#internal/nuxt/paths': './internal/nuxt/paths.mjs',
    },
  }

  try {
    const raw = await fs.readFile(DIST_PACKAGE_JSON, 'utf8')
    const parsed = JSON.parse(raw)
    pkg = {
      ...parsed,
      type: parsed.type || 'module',
      imports: {
        ...(parsed.imports || {}),
        '#internal/nuxt/paths': './internal/nuxt/paths.mjs',
      },
    }
  } catch {
    // keep default pkg
  }

  await fs.writeFile(DIST_PACKAGE_JSON, JSON.stringify(pkg, null, 2), 'utf8')
}

await ensurePathsFile()
await ensureDistPackageJson()
console.log('[ensure-nuxt-internal] patched .nuxt/dist/server internal aliases')
