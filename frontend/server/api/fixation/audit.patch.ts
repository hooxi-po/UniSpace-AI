import type { Project, Attachment, AssetSplitItem } from '~/server/utils/fixation-audit-db'
import {
  updateProject,
  addAttachment,
  updateAttachment,
  deleteAttachment,
  addSplitItem,
  deleteSplitItem,
} from '~/server/utils/fixation-audit-db'

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

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.projectId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId required' })
  }

  const projectId = body.projectId

  switch (body.op) {
    case 'updateProject': {
      const next = await updateProject(projectId, body.updates || {})
      return { project: next }
    }
    case 'addAttachment': {
      if (!body.attachment) throw createError({ statusCode: 400, statusMessage: 'attachment required' })
      const next = await addAttachment(projectId, body.attachment)
      return { project: next }
    }
    case 'updateAttachment': {
      if (!body.attachmentId) throw createError({ statusCode: 400, statusMessage: 'attachmentId required' })
      const next = await updateAttachment(projectId, body.attachmentId, body.attachmentUpdates || {})
      return { project: next }
    }
    case 'deleteAttachment': {
      if (!body.attachmentId) throw createError({ statusCode: 400, statusMessage: 'attachmentId required' })
      const next = await deleteAttachment(projectId, body.attachmentId)
      return { project: next }
    }
    case 'addSplitItem': {
      if (!body.splitItem) throw createError({ statusCode: 400, statusMessage: 'splitItem required' })
      const next = await addSplitItem(projectId, body.splitItem)
      return { project: next }
    }
    case 'deleteSplitItem': {
      if (!body.splitItemId) throw createError({ statusCode: 400, statusMessage: 'splitItemId required' })
      const next = await deleteSplitItem(projectId, body.splitItemId)
      return { project: next }
    }
    default:
      throw createError({ statusCode: 400, statusMessage: 'unknown op' })
  }
})







