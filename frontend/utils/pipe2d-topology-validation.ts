import type { PipeEdge, PipeGraph, PipeNode } from './pipe2d-graph'

export type ValidationIssueCode = 'dangling-node' | 'self-loop' | 'duplicate-edge'

export type ValidationIssue = {
  id: string
  code: ValidationIssueCode
  severity: 'warning' | 'error'
  message: string
  nodeIds: string[]
  edgeIds: string[]
}

function buildDegreeMap(graph: PipeGraph) {
  const degreeMap = new Map<string, number>()
  for (const node of graph.nodes) {
    degreeMap.set(node.id, 0)
  }
  for (const edge of graph.edges) {
    degreeMap.set(edge.sourceId, (degreeMap.get(edge.sourceId) || 0) + 1)
    degreeMap.set(edge.targetId, (degreeMap.get(edge.targetId) || 0) + 1)
  }
  return degreeMap
}

function describeNode(node: PipeNode | undefined) {
  return node ? (node.attributes.label || node.id) : '未知节点'
}

function describeEdge(edge: PipeEdge | undefined) {
  return edge ? (edge.attributes.label || edge.id) : '未知管段'
}

export function validateTopology(graph: PipeGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodesById = new Map(graph.nodes.map(node => [node.id, node]))
  const edgesById = new Map(graph.edges.map(edge => [edge.id, edge]))
  const degreeMap = buildDegreeMap(graph)

  for (const node of graph.nodes) {
    if ((degreeMap.get(node.id) || 0) === 0) {
      issues.push({
        id: `dangling:${node.id}`,
        code: 'dangling-node',
        severity: 'warning',
        message: `孤立节点: ${describeNode(node)}`,
        nodeIds: [node.id],
        edgeIds: [],
      })
    }
  }

  for (const edge of graph.edges) {
    if (edge.sourceId === edge.targetId) {
      issues.push({
        id: `self-loop:${edge.id}`,
        code: 'self-loop',
        severity: 'error',
        message: `自环管段: ${describeEdge(edge)}`,
        nodeIds: [edge.sourceId],
        edgeIds: [edge.id],
      })
    }
  }

  const duplicateGroups = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const key = [edge.sourceId, edge.targetId].sort().join('::')
    const existing = duplicateGroups.get(key)
    if (existing) existing.push(edge.id)
    else duplicateGroups.set(key, [edge.id])
  }

  for (const edgeIds of duplicateGroups.values()) {
    if (edgeIds.length < 2) continue
    const sampleEdge = edgesById.get(edgeIds[0])
    const sampleNodeIds = sampleEdge ? [sampleEdge.sourceId, sampleEdge.targetId] : []
    issues.push({
      id: `duplicate:${edgeIds.join(',')}`,
      code: 'duplicate-edge',
      severity: 'error',
      message: `重复管段: ${edgeIds.map(id => describeEdge(edgesById.get(id))).join('、')}`,
      nodeIds: sampleNodeIds,
      edgeIds,
    })
  }

  return issues
}
