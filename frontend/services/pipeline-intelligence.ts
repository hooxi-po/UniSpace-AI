import { pipelineOpsService } from './pipeline-ops'
import type { ImpactedBuildingRef, PipelineMedium, PipelineOrderType, PipelinePriority } from '~/types/pipeline-ops'
import type { PipelineWorkOrderTemplate } from '~/types/pipeline-ops-template'

export interface ImpactAnalysisRequest {
  segmentIds?: string[]
  nodeIds?: string[]
  buildingId?: string
  buildingName?: string
  medium?: PipelineMedium
  area?: string
}

export interface ImpactAnalysisResponse {
  impactedBuildings: ImpactedBuildingRef[]
  estimatedImpactHours: number
  affectedUserCount: number
}

export interface TemplateRecommendRequest {
  segmentIds?: string[]
  nodeIds?: string[]
  area?: string
  medium?: PipelineMedium
  allowedType?: PipelineOrderType
}

export interface TemplateRecommendResponse extends PipelineWorkOrderTemplate {
  reason: string
  confidence: number
}

type BuildingInventoryResponse = {
  buildings: Array<{
    code: string
    buildingName: string
    roomCount?: number | null
    floorCount?: number | null
  }>
  rooms: Array<{
    id: string
    buildingCode: string
    buildingName: string
    roomNo: string
    floor: number
  }>
}

type BuildingSeed = { buildingId: string; buildingName: string }

const TOPOLOGY_IMPACT_INDEX: Record<string, BuildingSeed[]> = {
  'N-1001': [{ buildingId: 'BLD-001', buildingName: '博学楼' }],
  'N-1002': [{ buildingId: 'BLD-001', buildingName: '博学楼' }],
  'N-2301': [{ buildingId: 'BLD-002', buildingName: '综合实验楼' }],
  'N-5011': [{ buildingId: 'BLD-003', buildingName: '学生宿舍楼' }],
  'N-5012': [{ buildingId: 'BLD-003', buildingName: '学生宿舍楼' }],
  'N-8801': [{ buildingId: 'BLD-004', buildingName: '创新创业中心' }],
  'S-2101': [{ buildingId: 'BLD-001', buildingName: '博学楼' }],
  'S-4302': [{ buildingId: 'BLD-002', buildingName: '综合实验楼' }],
  'S-4303': [{ buildingId: 'BLD-002', buildingName: '综合实验楼' }],
  'S-6101': [{ buildingId: 'BLD-003', buildingName: '学生宿舍楼' }],
  'S-9921': [{ buildingId: 'BLD-004', buildingName: '创新创业中心' }],
}

let inventoryPromise: Promise<BuildingInventoryResponse> | null = null

async function loadBuildingInventory() {
  if (!inventoryPromise) {
    inventoryPromise = $fetch<BuildingInventoryResponse>('/api/buildings', {
      query: {
        includeRooms: true,
        limit: 3000,
        offset: 0,
      },
    }).catch((error) => {
      inventoryPromise = null
      throw error
    })
  }
  return await inventoryPromise
}

function normalizeText(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function inferImpactHours(medium: PipelineMedium, buildingCount: number, roomCount: number) {
  const base = medium === 'sewage' ? 5 : medium === 'water' ? 4 : medium === 'drainage' ? 3 : 4
  const load = Math.min(4, Math.ceil(roomCount / 8)) + Math.max(0, buildingCount - 1)
  return Math.max(1, base + load)
}

function inferAffectedUsers(medium: PipelineMedium, roomCount: number, buildingCount: number) {
  const perRoom = medium === 'water' ? 6 : medium === 'sewage' ? 4 : medium === 'drainage' ? 3 : 5
  if (roomCount > 0) return roomCount * perRoom
  return buildingCount * perRoom * 6
}

/**
 * 分析管段/节点的影响范围
 * 当前以前端可获取的楼宇/房间库存做快速预分析，提交建单后仍以后端真实推断为准。
 */
export async function analyzeImpactScope(
  request: ImpactAnalysisRequest
): Promise<ImpactAnalysisResponse> {
  const inventory = await loadBuildingInventory()
  const matched = new Map<string, BuildingSeed>()

  const nodeIds = Array.isArray(request.nodeIds) ? request.nodeIds : []
  const segmentIds = Array.isArray(request.segmentIds) ? request.segmentIds : []
  for (const key of [...nodeIds, ...segmentIds]) {
    for (const seed of TOPOLOGY_IMPACT_INDEX[key] || []) {
      matched.set(seed.buildingId, seed)
    }
  }

  const buildingId = String(request.buildingId || '').trim()
  if (buildingId) {
    const hit = inventory.buildings.find(item => item.code === buildingId)
    matched.set(buildingId, {
      buildingId,
      buildingName: hit?.buildingName || buildingId,
    })
  }

  const buildingName = String(request.buildingName || '').trim()
  if (buildingName) {
    const target = normalizeText(buildingName)
    const byName = inventory.buildings.find(item => normalizeText(item.buildingName) === target)
    if (byName) {
      matched.set(byName.code, { buildingId: byName.code, buildingName: byName.buildingName })
    } else if (!buildingId) {
      matched.set(buildingName, { buildingId: buildingName, buildingName })
    }
  }

  const impactedBuildings: ImpactedBuildingRef[] = Array.from(matched.values()).map((seed) => {
    const rooms = inventory.rooms
      .filter(room =>
        room.buildingCode === seed.buildingId
        || normalizeText(room.buildingName) === normalizeText(seed.buildingName),
      )
      .sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor
        return a.roomNo.localeCompare(b.roomNo, 'zh-CN')
      })

    const floors = Array.from(new Set(rooms.map(room => room.floor).filter(Number.isFinite))).sort((a, b) => a - b)

    return {
      buildingId: seed.buildingId,
      buildingName: seed.buildingName,
      floors,
      rooms: rooms.slice(0, 12).map(room => ({
        buildingId: seed.buildingId,
        buildingName: seed.buildingName,
        floorNo: Number.isFinite(room.floor) ? room.floor : null,
        roomNo: room.roomNo,
        roomId: room.id,
        equipmentIds: room.roomNo ? [`PUMP-${room.roomNo}`] : [],
      })),
    }
  })

  const roomCount = impactedBuildings.reduce((sum, building) => sum + building.rooms.length, 0)
  const medium = request.medium || 'mixed'

  return {
    impactedBuildings,
    estimatedImpactHours: inferImpactHours(medium, impactedBuildings.length, roomCount),
    affectedUserCount: inferAffectedUsers(medium, roomCount, impactedBuildings.length),
  }
}

/**
 * 根据历史故障类型和上下文智能推荐工单模板
 */
export async function recommendTemplate(
  request: TemplateRecommendRequest
): Promise<TemplateRecommendResponse> {
  // TODO: 实际调用后端接口
  // const response = await $fetch('/api/pipeline/recommend-template', {
  //   method: 'POST',
  //   body: request,
  // })

  // 模拟智能推荐逻辑
  return new Promise((resolve) => {
    setTimeout(() => {
      const { segmentIds = [], nodeIds = [], area = '', medium = 'water', allowedType } = request

      // 基于上下文的推荐逻辑
      let recommendedTemplate: TemplateRecommendResponse

      // 如果是供水管道
      if (medium === 'water') {
        if (area.includes('教学') || area.includes('实验')) {
          recommendedTemplate = {
            id: 'tpl-water-leak-auto',
            name: '供水管道漏水抢修',
            description: '供水管道发生漏水，需要紧急抢修',
            icon: '💧',
            category: 'maintenance',
            preset: {
              title: '供水管道漏水抢修',
              description: '管道漏水，影响正常供水',
              type: 'maintenance',
              pipelineMedium: 'water',
              priority: 'urgent',
              area: area || '教学区',
              assignee: '张工',
              reviewer: '李主管',
            },
            reason: '根据历史数据，该区域供水管道漏水频率较高，建议立即抢修',
            confidence: 0.85,
          }
        } else {
          recommendedTemplate = {
            id: 'tpl-water-maintenance-auto',
            name: '供水管道定期维护',
            description: '供水管道定期巡检维护',
            icon: '🔧',
            category: 'inspection',
            preset: {
              title: '供水管道定期维护',
              description: '定期检查管道状态，预防故障',
              type: 'inspection',
              pipelineMedium: 'water',
              priority: 'medium',
              area: area || '生活区',
              assignee: '王工',
              reviewer: '李主管',
            },
            reason: '该区域管道运行稳定，建议进行定期维护',
            confidence: 0.72,
          }
        }
      }
      // 如果是排水管道
      else if (medium === 'drainage') {
        recommendedTemplate = {
          id: 'tpl-drainage-blockage-auto',
          name: '排水管道疏通',
          description: '排水管道堵塞，需要疏通',
          icon: '🚰',
          category: 'maintenance',
          preset: {
            title: '排水管道疏通',
            description: '管道堵塞，排水不畅',
            type: 'maintenance',
            pipelineMedium: 'drainage',
            priority: 'high',
            area: area || '生活区',
            assignee: '赵工',
            reviewer: '李主管',
          },
          reason: '排水管道易堵塞，建议及时疏通',
          confidence: 0.78,
        }
      }
      // 如果是污水管道
      else if (medium === 'sewage') {
        recommendedTemplate = {
          id: 'tpl-sewage-inspection-auto',
          name: '污水管道检测',
          description: '污水管道定期检测',
          icon: '🔍',
          category: 'inspection',
          preset: {
            title: '污水管道检测',
            description: '检测管道状态，确保正常运行',
            type: 'inspection',
            pipelineMedium: 'sewage',
            priority: 'medium',
            area: area || '全校区',
            assignee: '孙工',
            reviewer: '李主管',
          },
          reason: '污水管道需要定期检测，防止环境污染',
          confidence: 0.68,
        }
      }
      // 默认推荐
      else {
        recommendedTemplate = {
          id: 'tpl-general-inspection-auto',
          name: '管道常规巡检',
          description: '管道常规巡检',
          icon: '📋',
          category: 'inspection',
          preset: {
            title: '管道常规巡检',
            description: '定期巡检管道设施',
            type: 'inspection',
            pipelineMedium: medium,
            priority: 'low',
            area: area || '全校区',
            assignee: '巡检员',
            reviewer: '李主管',
          },
          reason: '建议进行常规巡检',
          confidence: 0.60,
        }
      }

      if (allowedType && recommendedTemplate.preset.type !== allowedType) {
        recommendedTemplate = buildAllowedTypeRecommendation(allowedType, medium, area)
      }

      resolve(recommendedTemplate)
    }, 800)
  })
}

/**
 * 创建异常预警自动工单
 */
export async function createAlertWorkorder(params: {
  alertType: 'pressure' | 'flow' | 'quality'
  nodeId: string
  threshold: number
  currentValue: number
}): Promise<string> {
  const priority = deriveAlertPriority(params.currentValue, params.threshold)
  const workorderType: PipelineOrderType = params.alertType === 'quality' ? 'inspection' : 'maintenance'
  const alertLabel = getAlertTypeLabel(params.alertType)
  const response = await pipelineOpsService.autoCreate({
    trigger: 'telemetry_alert',
    reason: `${params.nodeId} ${alertLabel}异常，当前值 ${params.currentValue}，阈值 ${params.threshold}`,
    base: {
      title: `${params.nodeId} ${alertLabel}异常自动建单`,
      description: `${alertLabel}监测异常。当前值 ${params.currentValue}，阈值 ${params.threshold}。`,
      type: workorderType,
      pipelineMedium: 'water',
      area: '未分区',
      nodeIds: [params.nodeId],
      segmentIds: [],
      buildingId: '',
      buildingName: '',
      assignee: '',
      reviewer: '',
      priority,
      plannedDate: '',
      deadlineAt: '',
      createdBy: 'system',
    },
  })
  return response.workorder.id
}

function buildAllowedTypeRecommendation(
  allowedType: PipelineOrderType,
  medium: PipelineMedium,
  area: string,
): TemplateRecommendResponse {
  const areaText = area || '未分区'
  switch (allowedType) {
    case 'maintenance':
      return {
        id: `tpl-${medium}-maintenance-recommended`,
        name: '异常管段抢修',
        description: '基于当前看板类型，建议直接进入维修处置流程',
        icon: '🔧',
        category: 'maintenance',
        preset: {
          title: `${areaText}${medium === 'drainage' ? '排水' : medium === 'sewage' ? '污水' : '供水'}异常维修`,
          description: '根据智能分析结果，建议执行维修处置。',
          type: 'maintenance',
          pipelineMedium: medium,
          priority: 'high',
          area: areaText,
          assignee: '值班维修组',
          reviewer: '调度主管',
        },
        reason: '当前看板限定为维修工单，已按该类型给出可直接应用的推荐。',
        confidence: 0.7,
      }
    case 'retrofit':
      return {
        id: `tpl-${medium}-retrofit-recommended`,
        name: '异常管段改造评估',
        description: '建议发起改造评估与方案论证',
        icon: '🏗️',
        category: 'retrofit',
        preset: {
          title: `${areaText}异常管段改造评估`,
          description: '根据智能分析结果，建议进入改造评估流程。',
          type: 'retrofit',
          pipelineMedium: medium,
          priority: 'medium',
          area: areaText,
          assignee: '改造项目组',
          reviewer: '工程主管',
        },
        reason: '当前看板限定为改造工单，已提供同类型推荐。',
        confidence: 0.66,
      }
    case 'retire':
      return {
        id: `tpl-${medium}-retire-recommended`,
        name: '异常设施报废评估',
        description: '建议评估是否需要报废处置',
        icon: '🗑️',
        category: 'retire',
        preset: {
          title: `${areaText}异常设施报废评估`,
          description: '根据智能分析结果，建议进入报废评估流程。',
          type: 'retire',
          pipelineMedium: medium,
          priority: 'medium',
          area: areaText,
          assignee: '资产运维组',
          reviewer: '资产主管',
        },
        reason: '当前看板限定为报废工单，已提供同类型推荐。',
        confidence: 0.62,
      }
    case 'inspection':
    default:
      return {
        id: `tpl-${medium}-inspection-recommended`,
        name: '异常节点复核巡检',
        description: '建议先发起巡检复核，确认问题范围和严重程度',
        icon: '🔍',
        category: 'inspection',
        preset: {
          title: `${areaText}异常节点复核巡检`,
          description: '根据智能分析结果，建议先进行现场巡检复核。',
          type: 'inspection',
          pipelineMedium: medium,
          priority: 'medium',
          area: areaText,
          assignee: '巡检班组',
          reviewer: '值班主管',
        },
        reason: '当前看板限定为巡检工单，已提供同类型推荐。',
        confidence: 0.69,
      }
  }
}

function deriveAlertPriority(currentValue: number, threshold: number): PipelinePriority {
  if (!Number.isFinite(currentValue) || !Number.isFinite(threshold) || threshold <= 0) {
    return 'medium'
  }
  const ratio = currentValue / threshold
  if (ratio >= 1.5) return 'urgent'
  if (ratio >= 1.2) return 'high'
  if (ratio >= 1) return 'medium'
  return 'low'
}

function getAlertTypeLabel(alertType: 'pressure' | 'flow' | 'quality') {
  switch (alertType) {
    case 'pressure':
      return '压力'
    case 'flow':
      return '流量'
    case 'quality':
      return '水质'
    default:
      return '监测'
  }
}
