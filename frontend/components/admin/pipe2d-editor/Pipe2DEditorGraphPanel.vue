<script setup lang="ts">
import { computed } from 'vue'
import type { SelectedElement } from '~/composables/admin/usePipe2DEditorGraph'
import type {
  EdgeAttributes,
  NodeAttributes,
  NodeType,
  PipeEdge,
  PipeGraph,
  PipeNode,
} from '~/utils/pipe2d-graph'

const props = defineProps<{
  graph: PipeGraph
  selected: SelectedElement
}>()

const emit = defineEmits<{
  (e: 'update-node', nodeId: string, attrs: NodeAttributes): void
  (e: 'update-node-type', nodeId: string, type: NodeType): void
  (e: 'update-edge', edgeId: string, attrs: EdgeAttributes): void
  (e: 'toggle-edge-curve', edgeId: string): void
  (e: 'remove-node', nodeId: string): void
  (e: 'remove-edge', edgeId: string): void
}>()

const selectedNode = computed<PipeNode | null>(() => {
  const s = props.selected
  if (!s || s.kind !== 'node') return null
  return props.graph.nodes.find(n => n.id === s.nodeId) ?? null
})

const selectedEdge = computed<PipeEdge | null>(() => {
  const s = props.selected
  if (!s || s.kind !== 'edge') return null
  return props.graph.edges.find(e => e.id === s.edgeId) ?? null
})

const nodeTypeOptions: { value: NodeType; label: string }[] = [
  { value: 'default', label: '普通节点' },
  { value: 'manhole', label: '窨井' },
  { value: 'valve', label: '阀门' },
  { value: 'pump', label: '泵站' },
  { value: 'meter', label: '测点' },
  { value: 'junction', label: 'T形接口' },
]

function onNodeTypeChange(event: Event) {
  if (!selectedNode.value) return
  emit('update-node-type', selectedNode.value.id, (event.target as HTMLSelectElement).value as NodeType)
}

function onNodeAttrChange(key: keyof NodeAttributes, event: Event) {
  if (!selectedNode.value) return
  const raw = (event.target as HTMLInputElement).value
  const value = raw === '' ? undefined : (Number.isNaN(Number(raw)) ? raw : Number(raw))
  emit('update-node', selectedNode.value.id, { ...selectedNode.value.attributes, [key]: value })
}

function onEdgeAttrChange(key: keyof EdgeAttributes, event: Event) {
  if (!selectedEdge.value) return
  const raw = (event.target as HTMLInputElement).value
  const value = raw === '' ? undefined : (Number.isNaN(Number(raw)) ? raw : Number(raw))
  emit('update-edge', selectedEdge.value.id, { ...selectedEdge.value.attributes, [key]: value })
}
</script>



<template>
  <div v-if="selectedNode" class="graph-panel">
    <div class="graph-panel__title">节点属性</div>
    <div class="graph-panel__field">
      <label>节点类型</label>
      <select :value="selectedNode.type" class="graph-panel__select" @change="onNodeTypeChange">
        <option v-for="opt in nodeTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>
    <div class="graph-panel__field">
      <label>标签</label>
      <input :value="selectedNode.attributes.label ?? ''" class="graph-panel__input" placeholder="节点名称" @change="onNodeAttrChange('label', $event)" />
    </div>

    <!-- 窨井专属字段 -->
    <template v-if="selectedNode.type === 'manhole'">
      <div class="graph-panel__field">
        <label>窨井类型</label>
        <select :value="selectedNode.attributes.manholeType ?? 'inspection'" class="graph-panel__select" @change="onNodeAttrChange('manholeType', $event)">
          <option value="inspection">检查井</option>
          <option value="drainage">排水井</option>
          <option value="cable">电缆井</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div class="graph-panel__field">
        <label>窨井编号</label>
        <input :value="selectedNode.attributes.manholeNo ?? ''" class="graph-panel__input" placeholder="编号" @change="onNodeAttrChange('manholeNo', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>深度 (m)</label>
        <input type="number" :value="selectedNode.attributes.depth ?? ''" class="graph-panel__input" placeholder="米" step="0.1" @change="onNodeAttrChange('depth', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>直径 (m)</label>
        <input type="number" :value="selectedNode.attributes.diameter ?? ''" class="graph-panel__input" placeholder="米" step="0.1" @change="onNodeAttrChange('diameter', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>材质</label>
        <input :value="selectedNode.attributes.material ?? ''" class="graph-panel__input" placeholder="混凝土/砖砌等" @change="onNodeAttrChange('material', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>井盖类型</label>
        <input :value="selectedNode.attributes.coverType ?? ''" class="graph-panel__input" placeholder="铸铁/复合材料等" @change="onNodeAttrChange('coverType', $event)" />
      </div>
    </template>

    <!-- 阀门专属字段 -->
    <template v-if="selectedNode.type === 'valve'">
      <div class="graph-panel__field">
        <label>阀门类型</label>
        <select :value="selectedNode.attributes.valveType ?? 'gate'" class="graph-panel__select" @change="onNodeAttrChange('valveType', $event)">
          <option value="gate">闸阀</option>
          <option value="ball">球阀</option>
          <option value="butterfly">蝶阀</option>
          <option value="check">止回阀</option>
        </select>
      </div>
      <div class="graph-panel__field">
        <label>阀门编号</label>
        <input :value="selectedNode.attributes.valveNo ?? ''" class="graph-panel__input" placeholder="编号" @change="onNodeAttrChange('valveNo', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>口径 (mm)</label>
        <input type="number" :value="selectedNode.attributes.valveSize ?? ''" class="graph-panel__input" placeholder="毫米" step="1" @change="onNodeAttrChange('valveSize', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>阀门状态</label>
        <select :value="selectedNode.attributes.valveStatus ?? 'open'" class="graph-panel__select" @change="onNodeAttrChange('valveStatus', $event)">
          <option value="open">开启</option>
          <option value="closed">关闭</option>
          <option value="partial">半开</option>
        </select>
      </div>
    </template>

    <!-- 泵站专属字段 -->
    <template v-if="selectedNode.type === 'pump'">
      <div class="graph-panel__field">
        <label>流量 (m³/h)</label>
        <input type="number" :value="selectedNode.attributes.pumpCapacity ?? ''" class="graph-panel__input" placeholder="立方米/小时" step="1" @change="onNodeAttrChange('pumpCapacity', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>功率 (kW)</label>
        <input type="number" :value="selectedNode.attributes.pumpPower ?? ''" class="graph-panel__input" placeholder="千瓦" step="0.1" @change="onNodeAttrChange('pumpPower', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>扬程 (m)</label>
        <input type="number" :value="selectedNode.attributes.pumpHead ?? ''" class="graph-panel__input" placeholder="米" step="0.1" @change="onNodeAttrChange('pumpHead', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>运行状态</label>
        <select :value="selectedNode.attributes.pumpStatus ?? 'stopped'" class="graph-panel__select" @change="onNodeAttrChange('pumpStatus', $event)">
          <option value="running">运行中</option>
          <option value="stopped">停止</option>
          <option value="maintenance">维护中</option>
        </select>
      </div>
    </template>

    <!-- 测点专属字段 -->
    <template v-if="selectedNode.type === 'meter'">
      <div class="graph-panel__field">
        <label>传感器类型</label>
        <select :value="selectedNode.attributes.sensorType ?? 'pressure'" class="graph-panel__select" @change="onNodeAttrChange('sensorType', $event)">
          <option value="pressure">压力</option>
          <option value="flow">流量</option>
          <option value="temperature">温度</option>
          <option value="level">液位</option>
        </select>
      </div>
      <div class="graph-panel__field">
        <label>传感器ID</label>
        <input :value="selectedNode.attributes.sensorId ?? ''" class="graph-panel__input" placeholder="传感器ID" @change="onNodeAttrChange('sensorId', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>水表编号</label>
        <input :value="selectedNode.attributes.meterNo ?? ''" class="graph-panel__input" placeholder="水表编号" @change="onNodeAttrChange('meterNo', $event)" />
      </div>
      <div class="graph-panel__field">
        <label>水表口径 (mm)</label>
        <input type="number" :value="selectedNode.attributes.meterDiameter ?? ''" class="graph-panel__input" placeholder="毫米" step="1" @change="onNodeAttrChange('meterDiameter', $event)" />
      </div>
    </template>

    <!-- 通用字段 -->
    <div class="graph-panel__field">
      <label>高程 (m)</label>
      <input type="number" :value="selectedNode.attributes.elevation ?? ''" class="graph-panel__input" placeholder="米" step="0.1" @change="onNodeAttrChange('elevation', $event)" />
    </div>
    <div class="graph-panel__field">
      <label>安装日期</label>
      <input type="date" :value="selectedNode.attributes.installDate ?? ''" class="graph-panel__input" @change="onNodeAttrChange('installDate', $event)" />
    </div>
    <div class="graph-panel__field">
      <label>状态</label>
      <select :value="selectedNode.attributes.status ?? 'normal'" class="graph-panel__select" @change="onNodeAttrChange('status', $event)">
        <option value="normal">正常</option>
        <option value="warning">警告</option>
        <option value="error">故障</option>
      </select>
    </div>
    <div class="graph-panel__field">
      <label>备注</label>
      <textarea :value="selectedNode.attributes.notes ?? ''" class="graph-panel__textarea" placeholder="备注信息" rows="3" @change="onNodeAttrChange('notes', $event)"></textarea>
    </div>
    <button class="graph-panel__delete" type="button" @click="emit('remove-node', selectedNode.id)">删除节点</button>
  </div>

  <div v-else-if="selectedEdge" class="graph-panel">
    <div class="graph-panel__title">管段属性</div>
    <div class="graph-panel__field">
      <label>线型</label>
      <button class="graph-panel__toggle" type="button" @click="emit('toggle-edge-curve', selectedEdge.id)">
        {{ selectedEdge.edgeType === 'curve' ? '贝塞尔曲线' : '直线段' }}
      </button>
    </div>
    <div class="graph-panel__field">
      <label>管径 (mm)</label>
      <input type="number" :value="selectedEdge.attributes.diameter ?? ''" class="graph-panel__input" placeholder="mm" step="1" @change="onEdgeAttrChange('diameter', $event)" />
    </div>
    <div class="graph-panel__field">
      <label>管材</label>
      <input :value="selectedEdge.attributes.material ?? ''" class="graph-panel__input" placeholder="PE/PVC/钢管..." @change="onEdgeAttrChange('material', $event)" />
    </div>
    <div class="graph-panel__field">
      <label>压力等级 (MPa)</label>
      <input type="number" :value="selectedEdge.attributes.pressureRating ?? ''" class="graph-panel__input" step="0.1" @change="onEdgeAttrChange('pressureRating', $event)" />
    </div>
    <div class="graph-panel__field">
      <label>标签</label>
      <input :value="selectedEdge.attributes.label ?? ''" class="graph-panel__input" @change="onEdgeAttrChange('label', $event)" />
    </div>
    <div class="graph-panel__field">
      <label>备注</label>
      <input :value="selectedEdge.attributes.remark ?? ''" class="graph-panel__input" placeholder="备注" @change="onEdgeAttrChange('remark', $event)" />
    </div>
    <button class="graph-panel__delete" type="button" @click="emit('remove-edge', selectedEdge.id)">删除管段</button>
  </div>
</template>

<style scoped>
.graph-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.graph-panel__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.graph-panel__field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.graph-panel__field label {
  font-size: 11px;
  color: var(--color-text-secondary, #64748b);
}
.graph-panel__input,
.graph-panel__select,
.graph-panel__textarea {
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  background: var(--color-bg, #fff);
  color: var(--color-text, #1e293b);
  outline: none;
  font-family: inherit;
}
.graph-panel__input:focus,
.graph-panel__select:focus,
.graph-panel__textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px #6366f133;
}
.graph-panel__textarea {
  resize: vertical;
  min-height: 60px;
}
.graph-panel__toggle {
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #6366f1;
  border-radius: 4px;
  color: #6366f1;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.graph-panel__toggle:hover { background: #6366f111; }
.graph-panel__delete {
  margin-top: 4px;
  padding: 5px 8px;
  font-size: 12px;
  border: 1px solid #ef444466;
  border-radius: 4px;
  color: #ef4444;
  background: transparent;
  cursor: pointer;
  width: 100%;
}
.graph-panel__delete:hover { background: #ef444411; }
</style>
