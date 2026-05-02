import type { Project, Attachment, AssetSplitItem } from '~/server/utils/fixation-audit-db'
import {
  readAuditDb,
  updateProject,
  addAttachment,
  updateAttachment,
  deleteAttachment,
  addSplitItem,
  deleteSplitItem,
} from '~/server/utils/fixation-audit-db'
import { addFixationLog } from '~/server/utils/fixation-logs-db'

type Body = {
  op:
    | 'updateProject'
    | 'addAttachment'
    | 'updateAttachment'
    | 'deleteAttachment'
    | 'addSplitItem'
    | 'deleteSplitItem'
  projectId: string
  updates?: Partial<Project>
  attachment?: Attachment
  attachmentId?: string
  attachmentUpdates?: Partial<Attachment>
  splitItem?: AssetSplitItem
  splitItemId?: string
}

async function logAction(projectId: string, action: any, summary: string, detail?: any) {
  const db = await readAuditDb()
  const p = db.list.find(item => item.id === projectId)
  await addFixationLog({
    id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    operator: '当前用户',
    module: 'fixation',
    action,
    projectId,
    projectName: p?.name,
    summary,
    detail
  })
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.projectId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId required' })
  }

  const projectId = body.projectId

  switch (body.op) {
    case 'updateProject': {
      const next = await updateProject(projectId, body.updates || {})
      if (body.updates?.status) {
        await logAction(projectId, 'updateProject', `更新项目状态为：${body.updates.status}`, body.updates)
      }
      return { project: next }
    }
    case 'addAttachment': {
      if (!body.attachment) throw createError({ statusCode: 400, statusMessage: 'attachment required' })
      const next = await addAttachment(projectId, body.attachment)
      await logAction(projectId, 'addAttachment', `上传附件：${body.attachment.name}`, body.attachment)
      return { project: next }
    }
    case 'updateAttachment': {
      if (!body.attachmentId) throw createError({ statusCode: 400, statusMessage: 'attachmentId required' })
      const next = await updateAttachment(projectId, body.attachmentId, body.attachmentUpdates || {})
      await logAction(projectId, 'updateAttachment', `更新附件信息 (ID: ${body.attachmentId})`, body.attachmentUpdates)
      return { project: next }
    }
    case 'deleteAttachment': {
      if (!body.attachmentId) throw createError({ statusCode: 400, statusMessage: 'attachmentId required' })
      const next = await deleteAttachment(projectId, body.attachmentId)
      await logAction(projectId, 'deleteAttachment', `删除附件 (ID: ${body.attachmentId})`)
      return { project: next }
    }
    case 'addSplitItem': {
      if (!body.splitItem) throw createError({ statusCode: 400, statusMessage: 'splitItem required' })
      const next = await addSplitItem(projectId, body.splitItem)
      await logAction(projectId, 'addSplitItem', `新增资产拆分项：${body.splitItem.name}，金额：${body.splitItem.amount}`, body.splitItem)
      return { project: next }
    }
    case 'deleteSplitItem': {
      if (!body.splitItemId) throw createError({ statusCode: 400, statusMessage: 'splitItemId required' })
      const next = await deleteSplitItem(projectId, body.splitItemId)
      await logAction(projectId, 'deleteSplitItem', `删除资产拆分项 (ID: ${body.splitItemId})`)
      return { project: next }
    }
    default:
      throw createError({ statusCode: 400, statusMessage: 'unknown op' })
  }
})







