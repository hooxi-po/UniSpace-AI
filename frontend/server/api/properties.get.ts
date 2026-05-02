import { mockProperties } from '~/mock/properties.ts'

export default defineEventHandler(() => {
  return {
    list: mockProperties,
  }
})

