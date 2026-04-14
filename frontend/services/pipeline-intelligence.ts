import type { ImpactedBuildingRef, PipelineMedium } from '~/types/pipeline-ops'
import type { PipelineWorkOrderTemplate } from '~/types/pipeline-ops-template'

export interface ImpactAnalysisRequest {
  segmentIds?: string[]
  nodeIds?: string[]
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
}

export interface TemplateRecommendResponse extends PipelineWorkOrderTemplate {
  reason: string
  confidence: number
}

/**
 * 分析管段/节点的影响范围
 * 调用后端 GIS 空间分析接口
 */
export async function analyzeImpactScope(
  request: ImpactAnalysisRequest
): Promise<ImpactAnalysisResponse> {
  // TODO: 实际调用后端接口
  // const response = await $fetch('/api/pipeline/analyze-impact', {
  //   method: 'POST',
  //   body: request,
  // })

  // 模拟返回数据
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockBuildings: ImpactedBuildingRef[] = []

      // 如果有管段或节点，模拟返回受影响楼宇
      if ((request.segmentIds && request.segmentIds.length > 0) ||
          (request.nodeIds && request.nodeIds.length > 0)) {
        mockBuildings.push({
          buildingId: 'BLD-001',
          buildingName: '博学楼',
          floors: [1, 2, 3],
          rooms: [
            { buildingId: 'BLD-001', buildingName: '博学楼', floorNo: 1, roomNo: '101', roomId: 'R-101', equipmentIds: [] },
            { buildingId: 'BLD-001', buildingName: '博学楼', floorNo: 2, roomNo: '201', roomId: 'R-201', equipmentIds: [] },
            { buildingId: 'BLD-001', buildingName: '博学楼', floorNo: 3, roomNo: '301', roomId: 'R-301', equipmentIds: [] },
          ],
        })

        mockBuildings.push({
          buildingId: 'BLD-002',
          buildingName: '图书馆',
          floors: [1, 2],
          rooms: [
            { buildingId: 'BLD-002', buildingName: '图书馆', floorNo: 1, roomNo: 'L101', roomId: 'R-L101', equipmentIds: [] },
            { buildingId: 'BLD-002', buildingName: '图书馆', floorNo: 2, roomNo: 'L201', roomId: 'R-L201', equipmentIds: [] },
          ],
        })
      }

      const totalUsers = mockBuildings.reduce(
        (sum, b) => sum + b.rooms.length * 50, // 假设每个房间50人
        0
      )

      resolve({
        impactedBuildings: mockBuildings,
        estimatedImpactHours: 2.5,
        affectedUserCount: totalUsers,
      })
    }, 500)
  })
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
      const { segmentIds = [], nodeIds = [], area = '', medium = 'water' } = request

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
  // TODO: 实际调用后端接口
  // const response = await $fetch('/api/pipeline/auto-create-workorder', {
  //   method: 'POST',
  //   body: params,
  // })

  // 模拟创建工单
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('WO-AUTO-' + Date.now())
    }, 500)
  })
}
