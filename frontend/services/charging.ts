import type {
  ExtendedDepartmentFee,
  FeeBill,
  PaymentRecord,
  ReminderRecord,
  PersonUsage,
  PersonFeeBill,
  PersonPayment,
} from '~/server/utils/charging-db'

export const chargingService = {
  async fetchFees() {
    return $fetch<{ list: ExtendedDepartmentFee[] }>('/api/charging/fees')
  },

  async updateFee(id: string, updates: Partial<ExtendedDepartmentFee>, logSummary?: string) {
    return $fetch<{ fee: ExtendedDepartmentFee }>('/api/charging/fees', {
      method: 'PATCH',
      body: { id, updates, logSummary },
    })
  },

  async sendReminder(payload: { feeId: string; reminderType: ReminderRecord['reminderType']; content?: string; sentBy?: string }) {
    return $fetch<{ reminder: ReminderRecord }>('/api/charging/reminders', {
      method: 'POST',
      body: payload,
    })
  },

  async fetchReminders() {
    return $fetch<{ list: ReminderRecord[] }>('/api/charging/reminders')
  },

  async fetchPayments() {
    return $fetch<{ list: PaymentRecord[] }>('/api/charging/payments')
  },

  async recordDepartmentPayment(payload: {
    feeId: string
    billId: string
    billNo: string
    departmentName: string
    amount: number
    paymentMethod: PaymentRecord['paymentMethod']
    paymentDate?: string
    transactionNo?: string
    operator?: string
    voucherUrl?: string
  }) {
    return $fetch<{ payment: PaymentRecord }>('/api/charging/payments', {
      method: 'POST',
      body: payload,
    })
  },

  async fetchBills(year?: number, month?: string) {
    return $fetch<{ list: FeeBill[] }>('/api/charging/bills', {
      params: { year, month },
    })
  },

  // --- 个人缴费相关 (Personal Charging) ---
  async fetchPersonUsages(month: string) {
    return $fetch<{ list: PersonUsage[] }>('/api/charging/person-usages', {
      params: { month },
    })
  },

  async fetchPersonBills(year: number) {
    return $fetch<{ list: PersonFeeBill[] }>('/api/charging/person-bills', {
      params: { year },
    })
  },

  async generatePersonBills(month: string) {
    return $fetch<{ list: PersonFeeBill[] }>('/api/charging/person-bills', {
      method: 'POST',
      body: { month },
    })
  },

  async recordPersonPayment(payment: {
    billId: string
    personName: string
    amount: number
    paymentMethod: PersonPayment['paymentMethod']
    paymentDate: string
  }) {
    return $fetch<{ payment: PersonPayment }>('/api/charging/person-payments', {
      method: 'POST',
      body: payment,
    })
  },
} as const
