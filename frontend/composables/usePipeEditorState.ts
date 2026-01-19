import { ref, readonly } from 'vue'

export type PipeEditorMode = 'idle' | 'drawing'

const pipeEditorMode = ref<PipeEditorMode>('idle')
const drawingPoints = ref<number[][]>([])
const highlightedPipeId = ref<string | null>(null)

export const usePipeEditorState = () => {
  const startPipeDrawing = () => {
    pipeEditorMode.value = 'drawing'
    drawingPoints.value = []
  }

  const stopPipeDrawing = () => {
    pipeEditorMode.value = 'idle'
    drawingPoints.value = []
  }

  const addDrawingPoint = (lon: number, lat: number) => {
    if (pipeEditorMode.value !== 'drawing') return
    drawingPoints.value = [...drawingPoints.value, [lon, lat]]
  }

  const finishPipeDrawing = () => {
    pipeEditorMode.value = 'idle'
  }

  const highlightPipeById = (pipeId: string | null) => {
    highlightedPipeId.value = pipeId
  }

  return {
    pipeEditorMode: readonly(pipeEditorMode),
    drawingPoints: readonly(drawingPoints),
    startPipeDrawing,
    stopPipeDrawing,
    addDrawingPoint,
    finishPipeDrawing,
    highlightedPipeId: readonly(highlightedPipeId),
    highlightPipeById
  }
}
