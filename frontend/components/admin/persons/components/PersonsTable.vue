<template>
  <div class="table-container">
    <div v-if="loading" class="loading">加载中...</div>
    <table v-else class="persons-table">
      <thead>
        <tr>
          <th>工号</th>
          <th>姓名</th>
          <th>所属部门</th>
          <th>职称</th>
          <th>状态</th>
          <th class="actions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="person in persons" :key="person.personId">
          <td class="id-cell">{{ person.personId }}</td>
          <td class="name-cell">{{ person.personName }}</td>
          <td>{{ person.departmentName }}</td>
          <td>
            <span class="badge title-badge">{{ titleLabel(person.title) }}</span>
          </td>
          <td>
            <span :class="['status-dot', person.status?.toLowerCase() === 'active' ? 'active' : 'inactive']"></span>
            {{ person.status === 'Active' ? '在职' : '离职' }}
          </td>
          <td class="actions">
            <button class="edit-btn" @click="$emit('edit', person)">
              <Edit2 :size="16" /> 编辑
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { Edit2 } from 'lucide-vue-next'
import type { Person, PersonTitle } from '~/server/utils/persons-db'

defineProps<{
  persons: Person[]
  loading: boolean
}>()

defineEmits<{
  edit: [person: Person]
}>()

function titleLabel(t: PersonTitle) {
  const map: Record<PersonTitle, string> = {
    Assistant: '助教',
    Lecturer: '讲师',
    AssociateProfessor: '副教授',
    Professor: '教授',
    Other: '其他',
  }
  return map[t] || t
}
</script>

<style scoped>
.table-container {
  background: white;
  border-radius: 12px;
  border: 1px solid var(--border-color, #dee0e3);
  overflow: hidden;
}

.loading {
  padding: 40px;
  text-align: center;
  color: var(--text-muted, #8f959e);
}

.persons-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.persons-table th {
  text-align: left;
  padding: 12px 16px;
  background: #f8fafc;
  color: #646a73;
  font-weight: 600;
  border-bottom: 1px solid #eef0f2;
}

.persons-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #eef0f2;
  color: #1f2329;
}

.id-cell {
  font-family: monospace;
  color: #646a73;
}

.name-cell {
  font-weight: 600;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.title-badge {
  background: #eff6ff;
  color: #3370ff;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot.active { background: #22c55e; }
.status-dot.inactive { background: #94a3b8; }

.actions {
  text-align: right;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: #3370ff;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.edit-btn:hover {
  background: #f0f4ff;
}
</style>

