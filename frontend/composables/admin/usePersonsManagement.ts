import { ref, onMounted } from 'vue'
import { personsService } from '~/services/persons'
import type { Person } from '~/server/utils/persons-db'

export function usePersonsManagement() {
  const persons = ref<Person[]>([])
  const loading = ref(false)
  const updating = ref(false)

  async function fetchPersons() {
    loading.value = true
    try {
      const res = await personsService.fetchPersons()
      persons.value = res.list
    } catch (err) {
      console.error('Failed to fetch persons:', err)
    } finally {
      loading.value = false
    }
  }

  async function updatePerson(person: Person) {
    updating.value = true
    try {
      await personsService.updatePerson(person)
      await fetchPersons()
    } catch (err) {
      console.error('Failed to update person:', err)
      throw err
    } finally {
      updating.value = false
    }
  }

  onMounted(fetchPersons)

  return {
    persons,
    loading,
    updating,
    fetchPersons,
    updatePerson,
  }
}

