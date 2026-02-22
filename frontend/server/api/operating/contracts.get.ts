import { readOperatingDB, writeOperatingDB } from '~/server/utils/operating-db'

export default defineEventHandler(async () => {
  const db = await readOperatingDB()

  if (!Array.isArray(db.contracts)) {
    db.contracts = []
    await writeOperatingDB(db)
  }

  // 轻量修复：确保 spaceName 可靠
  const spacesById = new Map(db.spaces.map((s) => [s.id, s]))
  const contracts = db.contracts.map((c) => ({
    ...c,
    spaceName: c.spaceName || spacesById.get(c.spaceId)?.name || c.spaceId,
  }))

  // 若发生修复，写回 DB
  const needWriteBack = contracts.some((c, i) => c.spaceName !== db.contracts[i]?.spaceName)
  if (needWriteBack) {
    db.contracts = contracts
    await writeOperatingDB(db)
  }

  return {
    source: 'mock',
    contracts,
  }
})
