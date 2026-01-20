import type { PipeNode, Alert, Building, WorkOrder } from '~/types.ts'

export const BUILDINGS: Building[] = [
  {
    id: 'B-LIB',
    name: '中心图书馆',
    type: 'admin',
    status: 'normal',
    coordinates: { x: 600, y: 250 },
    connectedPipeId: 'P-101',
    rooms: 120,
    keyEquipment: ['增压泵组 #1', '智能水表总阀'],
    powerConsumption: 450.2
  },
  {
    id: 'B-DORM-A',
    name: '北区宿舍 A栋',
    type: 'dorm',
    status: 'normal',
    coordinates: { x: 250, y: 450 },
    connectedPipeId: 'P-102',
    rooms: 300,
    keyEquipment: ['污水提升泵', '生活水箱'],
    powerConsumption: 890.5
  },
  {
    id: 'B-LAB-SCI',
    name: '理科实验楼',
    type: 'lab',
    status: 'warning',
    coordinates: { x: 300, y: 650 },
    connectedPipeId: 'P-103',
    rooms: 45,
    keyEquipment: ['酸碱中和池', '紧急喷淋系统'],
    powerConsumption: 1200.0
  }
]

export const PIPELINES: PipeNode[] = [
  {
    id: 'P-101',
    type: 'water',
    status: 'normal',
    pressure: 4.2,
    flowRate: 120,
    coordinates: [{x: 200, y: 300}, {x: 500, y: 300}, {x: 700, y: 150}],
    diameter: 'DN400',
    material: '球墨铸铁',
    depth: 1.5,
    installDate: '2019-05-12',
    lastMaintain: '2023-11-01',
    connectedBuildingIds: ['B-LIB']
  },
  {
    id: 'P-102',
    type: 'sewage',
    status: 'normal',
    pressure: 1.1,
    flowRate: 45,
    coordinates: [{x: 200, y: 500}, {x: 400, y: 500}, {x: 600, y: 650}],
    diameter: 'DN600',
    material: 'HDPE',
    depth: 3.2,
    installDate: '2018-03-20',
    lastMaintain: '2023-10-15',
    connectedBuildingIds: ['B-DORM-A']
  },
  {
    id: 'P-103',
    type: 'drain',
    status: 'critical',
    pressure: 0.8,
    flowRate: 20,
    coordinates: [{x: 300, y: 200}, {x: 300, y: 600}],
    diameter: 'DN300',
    material: '混凝土',
    depth: 2.0,
    installDate: '2015-08-10',
    lastMaintain: '2023-01-05',
    connectedBuildingIds: ['B-LAB-SCI']
  },
]

export const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'WO-20231201-01',
    targetId: 'P-103',
    type: 'repair',
    status: 'processing',
    description: 'C区排水管堵塞清理及内壁修复',
    date: '2023-12-01'
  },
  {
    id: 'WO-20231128-05',
    targetId: 'B-LAB-SCI',
    type: 'inspection',
    status: 'completed',
    description: '实验楼废液排放口水质例行检测',
    date: '2023-11-28'
  },
  {
    id: 'WO-20231202-03',
    targetId: 'P-101',
    type: 'maintenance',
    status: 'pending',
    description: '供水主管道阀门润滑保养',
    date: '2023-12-02'
  }
]

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'A-001',
    message: '4号扇区检测到压力下降',
    timestamp: '10:42:15',
    level: 'warning',
    location: '北区'
  },
  {
    id: 'A-002',
    message: '堵塞警报：排水管 P-103',
    timestamp: '10:45:30',
    level: 'critical',
    location: '中心广场'
  },
]

export const PRESSURE_DATA = [
  { time: '10:00', value: 4.0 },
  { time: '10:10', value: 4.1 },
  { time: '10:20', value: 3.8 },
  { time: '10:30', value: 4.2 },
  { time: '10:40', value: 2.5 }, // Drop
  { time: '10:50', value: 2.1 },
]
