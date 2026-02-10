import type { GaojibiaoRow } from '~/server/utils/reports-gaojibiao-db'

export const reportsService = {
  async fetchGaojibiao() {
    return $fetch<{ list: GaojibiaoRow[] }>('/api/reports/gaojibiao')
  },

  async upsertGaojibiaoRow(body: Omit<GaojibiaoRow, 'updatedAt'>) {
    return $fetch<{ row: GaojibiaoRow }>('/api/reports/gaojibiao', {
      method: 'POST',
      body,
    })
  },
} as const

