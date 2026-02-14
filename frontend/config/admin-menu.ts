import type { TabKey, SubKey, ThirdKey } from '~/types/admin'

export type MenuNode<K extends string = string> = {
  key: K
  label: string
  children?: readonly MenuNode[]
}

export const adminMenuConfig = [
  {
    key: 'assets',
    label: '资产中心',
    children: [
      { key: 'assets_buildings', label: '建筑数据' },
      { key: 'assets_pipelines', label: '管道数据' },
    ],
  },
  {
    key: 'property',
    label: '房产管理',
    children: [
      {
        key: 'property_fixation',
        label: '资产转固与管理',
        children: [
          { key: 'fix_new_project', label: '新建工程项目' },
          { key: 'fix_stock_import', label: '存量房产导入' },
          { key: 'fix_apply', label: '转固申请' },
          { key: 'fix_audit', label: '转固审核' },
          { key: 'fix_mapping', label: '高基表映射' },
          { key: 'fix_room_function', label: '房间功能划分' },
          { key: 'fix_logs', label: '操作记录' },
        ],
      },
      {
        key: 'property_allocation',
        label: '公用房归口调配管理',
        children: [
          { key: 'allocation_apply', label: '申请用房' },
          { key: 'allocation_approval', label: '用房审批' },
          { key: 'allocation_assignment', label: '房源分配' },
          { key: 'allocation_adjustment', label: '用房调整' },
          { key: 'allocation_records', label: '调整记录' },
          { key: 'allocation_analysis', label: '数据分析' },
        ],
      },
      {
        key: 'property_charging',
        label: '校内公用房使用收费管理',
        children: [
          { key: 'charging_overview', label: '费用总览' },
          { key: 'charging_personal', label: '个人缴费' },
          { key: 'charging_bills', label: '账单管理' },
          { key: 'charging_records', label: '缴费记录' },
          { key: 'charging_urge', label: '催缴管理' },
        ],
      },
      {
        key: 'property_operating',
        label: '经营性用房管理',
        children: [
          { key: 'operating_overview', label: '经营概览' },
          { key: 'operating_properties', label: '房源管理' },
          { key: 'operating_contracts', label: '合同管理' },
          { key: 'operating_rent', label: '租金管理' },
          { key: 'operating_analysis', label: '数据分析' },
        ],
      },
      {
        key: 'property_apartments',
        label: '公寓与宿舍管理',
        children: [
          { key: 'apartments_overview', label: '居住概览' },
          { key: 'apartments_application', label: '入住申请' },
          { key: 'apartments_rooms', label: '房间管理' },
          { key: 'apartments_utilities', label: '水电管理' },
          { key: 'apartments_deposit', label: '押金管理' },
          { key: 'apartments_assignment', label: '房间分配' },
        ],
      },
      {
        key: 'property_services',
        label: '维修与物业服务',
        children: [
          { key: 'services_workorders', label: '维修工单' },
          { key: 'services_property', label: '物业服务' },
          { key: 'services_stats', label: '数据统计' },
        ],
      },
      {
        key: 'property_inventory',
        label: '房产盘点核查',
        children: [
          { key: 'inventory_tasks', label: '盘点任务' },
          { key: 'inventory_discrepancies', label: '差异处理' },
          { key: 'inventory_stats', label: '统计分析' },
        ],
      },
      {
        key: 'property_query',
        label: '公房综合查询',
        children: [
          { key: 'query_multi_rooms', label: '一人多房' },
          { key: 'query_multi_people', label: '一房多人' },
          { key: 'query_department', label: '部门概况' },
          { key: 'query_quota', label: '定额查询' },
          { key: 'query_public', label: '公用房查询' },
          { key: 'query_commercial', label: '商用房查询' },
        ],
      },
      {
        key: 'property_reports',
        label: '统计报表中心',
        children: [
          { key: 'reports_moe', label: '教育部高基表' },
          { key: 'reports_custom', label: '自定义报表' },
          { key: 'reports_logs', label: '操作日志' },
        ],
      },
    ],
  },
] as const satisfies readonly MenuNode[]

export type AdminTabKey = (typeof adminMenuConfig)[number]['key'] & TabKey
export type AdminSubKey = Exclude<(typeof adminMenuConfig)[number]['children'], undefined>[number]['key'] & SubKey

export function getTabs() {
  return adminMenuConfig.map(({ key, label }) => ({ key, label })) as { key: TabKey; label: string }[]
}

export function getSubTabs(tab: TabKey) {
  const active = adminMenuConfig.find(i => i.key === tab)
  return (active?.children ?? []) as { key: SubKey; label: string; children?: readonly MenuNode[] }[]
}

export function getThirdTabs(tab: TabKey, sub: SubKey) {
  const active = adminMenuConfig.find(i => i.key === tab)
  const subNode = active?.children?.find(i => i.key === sub) as any
  return (subNode?.children ?? []) as { key: ThirdKey; label: string }[]
}

