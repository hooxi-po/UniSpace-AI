import { readOperatingDB, writeOperatingDB, type OperatingBidItem } from '../../utils/operating-db'

type Body = {
  spaceId: string
  company: string
  contactPerson: string
  contactPhone?: string
  amount: number
}

function formatDate(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.spaceId) throw createError({ statusCode: 400, statusMessage: 'spaceId_required' })
  if (!body?.company?.trim()) throw createError({ statusCode: 400, statusMessage: 'company_required' })
  if (!body?.contactPerson?.trim()) throw createError({ statusCode: 400, statusMessage: 'contactPerson_required' })
  if (typeof body.amount !== 'number' || Number.isNaN(body.amount) || body.amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'amount_invalid' })
  }

  const db = await readOperatingDB()
  const idx = db.spaces.findIndex(s => s.id === body.spaceId)
  if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'space_not_found' })

  const space = db.spaces[idx]
  if (space.status !== '公开招租') {
    throw createError({ statusCode: 409, statusMessage: 'space_not_open_for_bidding' })
  }

  if (!Array.isArray(space.bids)) space.bids = []

  const currentMax = space.bids.reduce((max, b) => Math.max(max, typeof b.amount === 'number' ? b.amount : 0), 0)
  if (body.amount <= currentMax) {
    throw createError({ statusCode: 409, statusMessage: 'amount_must_be_higher_than_current_max' })
  }

  // 若之前存在 Winner，新的有效出价出现后，Winner 自动降级为 Valid
  space.bids = space.bids.map((b) => (b.status === 'Winner' ? { ...b, status: 'Valid' } : b))

  const bid: OperatingBidItem = {
    id: `bid_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    spaceId: body.spaceId,
    company: body.company.trim(),
    contactPerson: body.contactPerson.trim(),
    contactPhone: body.contactPhone?.trim() || undefined,
    amount: body.amount,
    bidDate: formatDate(),
    status: 'Winner',
  }

  space.bids.unshift(bid)

  db.spaces[idx] = space
  await writeOperatingDB(db)

  return { source: 'mock', bid }
})

