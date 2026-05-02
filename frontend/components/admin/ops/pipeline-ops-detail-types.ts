import type { PumpAction } from '~/types/pipeline-ops'

export type ImpactFormState = {
  json: string
  bypass: string
  note: string
}

export type LogFormState = {
  actor: string
  stage: 'progress' | 'pause_or_exception' | 'acceptance' | 'notification'
  content: string
  nodeId: string
  lng: number | undefined
  lat: number | undefined
  mobile: boolean
}

export type PumpFormState = {
  actor: string
  action: PumpAction
  durationMinutes: number
  buildingIdsText: string
}

export type PumpUiState = {
  running: boolean
  total: number
  completed: number
  progress: number
  countdown: number
}

export type InspectionFormState = {
  actor: string
  checkinNodeId: string
  judgement: 'normal' | 'abnormal'
  pressure: number | undefined
  waterQuality: number | undefined
  issueText: string
  lng: number | undefined
  lat: number | undefined
  photoUrlsText: string
}

export type TimelineEntry = {
  id: string
  label: string
  createdAt?: string
  content: string
}
