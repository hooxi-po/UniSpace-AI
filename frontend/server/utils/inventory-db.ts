import type { InventoryDiscrepancy, InventoryTask, InventoryTaskDetail } from '~/services/inventory'

const tasks: InventoryTask[] = [
  {
    id: 'INV-2026-001',
    year: 2026,
    taskName: '教学楼A区年度固定资产盘点',
    building: '教学楼A区',
    scope: '建筑结构、强弱电、公共家具',
    ownerDept: '国资与实验室管理处',
    leader: '赵工',
    dueDate: '2026-04-15',
    status: '进行中',
    phase: '现场盘点',
    progress: 64,
    checkedAssets: 1280,
    totalAssets: 2000,
    discrepancyCount: 23,
    lastUpdatedAt: '2026-03-21 14:20',
  },
  {
    id: 'INV-2026-002',
    year: 2026,
    taskName: '学生宿舍北区年度盘点',
    building: '学生宿舍北区',
    scope: '房间家具、水电设施、门禁设备',
    ownerDept: '后勤保障处',
    leader: '陈老师',
    dueDate: '2026-04-10',
    status: '待复核',
    phase: '差异复核',
    progress: 88,
    checkedAssets: 1760,
    totalAssets: 2000,
    discrepancyCount: 41,
    lastUpdatedAt: '2026-03-22 09:10',
  },
  {
    id: 'INV-2026-003',
    year: 2026,
    taskName: '教师公寓东区年度盘点',
    building: '教师公寓东区',
    scope: '房屋主体、消防、管网终端设备',
    ownerDept: '后勤保障处',
    leader: '李工',
    dueDate: '2026-03-30',
    status: '逾期',
    phase: '现场盘点',
    progress: 52,
    checkedAssets: 910,
    totalAssets: 1750,
    discrepancyCount: 35,
    lastUpdatedAt: '2026-03-18 17:42',
  },
  {
    id: 'INV-2026-004',
    year: 2026,
    taskName: '图书馆与信息中心资产盘点',
    building: '图书馆',
    scope: '阅览区资产、机房设备、消防监测',
    ownerDept: '信息化建设办公室',
    leader: '周老师',
    dueDate: '2026-05-08',
    status: '未开始',
    phase: '准备阶段',
    progress: 10,
    checkedAssets: 160,
    totalAssets: 1600,
    discrepancyCount: 0,
    lastUpdatedAt: '2026-03-10 10:30',
  },
  {
    id: 'INV-2026-005',
    year: 2026,
    taskName: '体育馆及看台设施盘点',
    building: '体育馆',
    scope: '钢结构、灯光、看台座椅、消防',
    ownerDept: '后勤保障处',
    leader: '王工',
    dueDate: '2026-03-25',
    status: '已完成',
    phase: '结果归档',
    progress: 100,
    checkedAssets: 980,
    totalAssets: 980,
    discrepancyCount: 7,
    lastUpdatedAt: '2026-03-20 16:05',
  },
]

const discrepancies: Record<string, InventoryDiscrepancy[]> = {
  'INV-2026-001': [
    {
      id: 'D-1001',
      assetCode: 'A-BLD-A-001',
      assetName: '配电箱',
      location: 'A区-1层西侧',
      problemType: '状态异常',
      severity: '中',
      suggestion: '更换老化断路器并复测',
      discoveredAt: '2026-03-20 11:20',
      reviewer: '设备组',
    },
  ],
  'INV-2026-002': [
    {
      id: 'D-2001',
      assetCode: 'A-DORM-N-311',
      assetName: '衣柜',
      location: '北区3栋311',
      problemType: '账实不符',
      severity: '低',
      suggestion: '更新资产台账规格',
      discoveredAt: '2026-03-21 10:10',
      reviewer: '宿管组',
    },
    {
      id: 'D-2002',
      assetCode: 'A-DORM-N-220',
      assetName: '智能门锁',
      location: '北区2栋220',
      problemType: '缺失',
      severity: '高',
      suggestion: '核查维修工单并补装',
      discoveredAt: '2026-03-21 15:05',
      reviewer: '安全组',
    },
  ],
  'INV-2026-003': [
    {
      id: 'D-3001',
      assetCode: 'A-APT-E-112',
      assetName: '消防喷淋头',
      location: '东区1栋12层',
      problemType: '位置异常',
      severity: '中',
      suggestion: '核对图纸后修正位置编码',
      discoveredAt: '2026-03-18 16:00',
      reviewer: '消防组',
    },
  ],
}

function withPermissions(task: InventoryTask): InventoryTask {
  const canStartReview = task.status === '待复核' || (task.status === '进行中' && task.progress >= 80)
  const canArchive = task.phase === '结果归档' || (task.status === '待复核' && task.progress >= 90)

  let reason = ''
  if (!canStartReview && !canArchive) {
    reason = '当前任务阶段不满足操作条件'
  } else if (!canStartReview) {
    reason = '需先进入复核阶段'
  } else if (!canArchive) {
    reason = '需先完成复核后归档'
  }

  return {
    ...task,
    permissions: { canStartReview, canArchive, reason },
  }
}

export function listInventoryTasks() {
  return tasks.map(withPermissions)
}

export function getInventoryTaskDetail(id: string): InventoryTaskDetail | null {
  const task = tasks.find(t => t.id === id)
  if (!task) return null
  return {
    task: withPermissions(task),
    discrepancies: discrepancies[id] || [],
  }
}

export function updateInventoryTask(id: string, patch: Partial<InventoryTask>) {
  const idx = tasks.findIndex(t => t.id === id)
  if (idx < 0) return null
  tasks[idx] = { ...tasks[idx], ...patch }
  return withPermissions(tasks[idx])
}