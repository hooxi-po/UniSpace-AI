<template>
  <div class="persons-view">
    <div class="view-header">
      <div class="header-content">
        <h2 class="view-title">人员管理</h2>
        <p class="view-subtitle">管理校内教职工信息，包括职称、部门及状态，影响公房定额核算。</p>
      </div>
      <button class="refresh-btn" @click="fetchPersons" :disabled="loading">
        <RefreshCw :size="16" :class="{ spinning: loading }" /> 刷新数据
      </button>
    </div>

    <div class="view-body">
      <PersonsTable 
        :persons="persons" 
        :loading="loading" 
        @edit="handleEdit" 
      />
    </div>

    <PersonEditModal 
      :is-open="isEditModalOpen" 
      :person="selectedPerson" 
      :loading="updating"
      @close="closeModal"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { usePersonsManagement } from '~/composables/admin/usePersonsManagement'
import PersonsTable from '~/components/admin/persons/components/PersonsTable.vue'
import PersonEditModal from '~/components/admin/persons/components/PersonEditModal.vue'
import type { Person } from '~/server/utils/persons-db'

const { persons, loading, updating, fetchPersons, updatePerson } = usePersonsManagement()

const isEditModalOpen = ref(false)
const selectedPerson = ref<Person | null>(null)

function handleEdit(person: Person) {
  selectedPerson.value = person
  isEditModalOpen.value = true
}

function closeModal() {
  isEditModalOpen.value = false
  selectedPerson.value = null
}

async function handleSave(updatedPerson: Person) {
  try {
    await updatePerson(updatedPerson)
    closeModal()
  } catch (err) {
    alert('保存失败，请重试')
  }
}
</script>

<style scoped>
.persons-view {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.view-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.view-subtitle {
  margin-top: 4px;
  font-size: 14px;
  color: #646a73;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  font-size: 14px;
  color: #1f2329;
  cursor: pointer;
  transition: background 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #f5f6f7;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.view-body {
  flex: 1;
}
</style>

