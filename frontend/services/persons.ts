import type { Person } from '~/server/utils/persons-db'

export const personsService = {
  async fetchPersons() {
    return $fetch<{ list: Person[] }>('/api/persons')
  },

  async updatePerson(person: Person) {
    return $fetch<{ person: Person }>('/api/persons', {
      method: 'PATCH',
      body: person,
    })
  },
} as const

