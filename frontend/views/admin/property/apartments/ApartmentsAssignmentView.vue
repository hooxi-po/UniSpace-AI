<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">房间分配</h2>
        <p class="subtitle">空闲宿舍按床位分配（学生/教师）</p>
      </div>
    </div>

    <div class="stats">
      <div class="card">
        <span>可分配房间</span>
        <strong>{{ filteredRooms.length }}</strong>
      </div>
      <div class="card">
        <span>可分配床位</span>
        <strong>{{ totalBeds }}</strong>
      </div>
    </div>

    <div class="filterCard">
      <div class="filterRow">
        <div class="field field--grow">
          <label class="fieldLabel">关键词</label>
          <input v-model="keyword" class="input" placeholder="请输入关键词（楼栋、房号、类型）" />
        </div>
      </div>
      <div class="filterActions">
        <button class="btnAction btnAction--primary" type="button">搜索</button>
        <button class="btnAction" type="button" @click="keyword = ''">重置</button>
        <span class="countHint">筛选结果：{{ filteredRooms.length }} 条</span>
      </div>
    </div>

    <section class="section">
      <div class="sectionTitle">空闲房间列表</div>

      <div v-if="loading" class="emptyText">加载中...</div>
      <div v-else-if="filteredRooms.length === 0" class="emptyText">暂无可分配房间</div>

      <div v-else class="tableWrap">
        <table class="table">
          <thead>
            <tr>
              <th>楼栋</th>
              <th>房号</th>
              <th>宿舍类型</th>
              <th>可分配床位</th>
              <th>总床位</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="room in filteredRooms" :key="room.id">
              <td>{{ room.buildingName }}</td>
              <td>{{ room.roomNo }}</td>
              <td>{{ room.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍' }}</td>
              <td>{{ room.availableBeds }}</td>
              <td>{{ room.totalBeds }}</td>
              <td>
                <span class="statusTag is-empty">空闲</span>
              </td>
              <td>
                <button class="btnAssign" @click="assign(room)">分配床位</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apartmentsService } from '~/services/apartments'

type Row = {
  id: string
  buildingName: string
  roomNo: string
  type: 'Student' | 'TeacherApartment'
  totalBeds: number
  availableBeds: number
}

const loading = ref(false)
const keyword = ref('')
const rooms = ref<Row[]>([])

const filteredRooms = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  if (!key) return rooms.value
  return rooms.value.filter((r) =>
    [r.buildingName, r.roomNo, r.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍']
      .some((v) => String(v).toLowerCase().includes(key)),
  )
})

const totalBeds = computed(() => filteredRooms.value.reduce((s, r) => s + r.availableBeds, 0))

async function load() {
  loading.value = true
  try {
    const resp = await apartmentsService.getRooms({ status: 'Empty' })
    rooms.value = (resp.rooms || []).map((r) => ({
      id: r.id,
      buildingName: r.buildingName,
      roomNo: r.roomNo,
      type: r.type,
      totalBeds: r.type === 'TeacherApartment' ? 2 : 4,
      availableBeds: r.type === 'TeacherApartment' ? 2 : 4,
    }))
  } finally {
    loading.value = false
  }
}

async function assign(room: Row) {
  const who = window.prompt('请输入分配对象姓名（学生/教师）')
  if (!who) return
  await $fetch('/api/apartments/room-reassign', {
    method: 'PATCH',
    body: {
      roomId: room.id,
      tenantType: room.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍',
      department: who,
    },
  })
  await load()
}

onMounted(load)
</script>

<style scoped>
.page { display: grid; gap: 16px; padding: 16px; }
.header { display: flex; justify-content: space-between; }
.title { margin: 0; font-size: 20px; font-weight: 800; }
.subtitle { margin: 4px 0 0; color: #646a73; font-size: 13px; }

.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.card { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; }
.card span { color: #646a73; font-size: 12px; display: block; }
.card strong { font-size: 22px; }

.filterCard {
  background: #fff;
  border: 1px solid var(--border, #dfe3ea);
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 10px;
}
.filterRow { display: grid; gap: 10px; grid-template-columns: 1fr; }
.field { display: grid; gap: 6px; }
.field--grow { min-width: 0; }
.fieldLabel { font-size: 12px; color: #646a73; }
.input { width: 100%; border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.filterActions { display: flex; align-items: center; gap: 8px; }
.countHint { margin-left: auto; font-size: 13px; color: #646a73; }
.btnAction {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border, #dfe3ea);
  background: #fff;
}
.btnAction--primary { background: #3370ff; border-color: #3370ff; color: #fff; }

.section {
  background: #fff;
  border: 1px solid var(--border, #dfe3ea);
  border-radius: 12px;
  padding: 14px;
}
.sectionTitle { font-size: 14px; font-weight: 700; margin-bottom: 12px; }

.emptyText { color: #646a73; font-size: 13px; }

.tableWrap {
  overflow-x: auto;
  border: 1px solid var(--border-light, #edf0f5);
  border-radius: 10px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  border-bottom: 1px solid var(--border-light, #edf0f5);
  padding: 10px 8px;
  font-size: 13px;
  text-align: left;
}

.table th {
  color: #646a73;
  font-weight: 600;
  background: #f8fafc;
}

.statusTag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
}
.statusTag.is-empty {
  background: #e8f2ff;
  color: #1d4ed8;
}

.btnAssign {
  border: 1px solid #3370ff;
  background: #3370ff;
  color: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 760px) {
  .stats { grid-template-columns: 1fr; }
  .filterActions { flex-wrap: wrap; }
  .countHint { margin-left: 0; }
}
</style>