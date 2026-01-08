/**
 * @file i18n.ts
 * @description 中文国际化翻译模块
 * 提供 GeoJSON 属性名和属性值的中英文映射
 */

/**
 * 属性名中文映射表
 * 将 GeoJSON 中的英文属性名翻译为中文显示
 */
export const propertyLabelMap: Record<string, string> = {
  'name': '名称',
  'short_name': '简称',
  'building': '建筑类型',
  'building:levels': '楼层数',
  'amenity': '设施类型',
  'layer': '层级',
  'id': 'ID',
  'timestamp': '更新时间',
  'version': '版本',
  'changeset': '变更集',
  'user': '编辑者',
  'uid': '用户ID'
}

/**
 * 建筑类型中文映射表
 * 将 OSM 建筑类型标签翻译为中文
 */
export const buildingTypeMap: Record<string, string> = {
  'dormitory': '宿舍楼',
  'university': '教学楼',
  'school': '教学楼',
  'restaurant': '餐厅',
  'warehouse': '仓库',
  'yes': '普通建筑'
}

/**
 * 设施类型中文映射表
 * 将 OSM 设施类型标签翻译为中文
 */
export const amenityTypeMap: Record<string, string> = {
  'restaurant': '餐厅',
  'toilets': '卫生间',
  'bicycle_parking': '自行车停放处',
  'university': '大学'
}

/**
 * 翻译属性值
 * 根据属性名将特定的英文值翻译为中文
 * @param propName - 属性名
 * @param value - 原始属性值
 * @returns 翻译后的属性值，如果没有对应翻译则返回原值
 */
export function translatePropertyValue(propName: string, value: string): string {
  // 翻译建筑类型
  if (propName === 'building' && buildingTypeMap[value]) {
    return buildingTypeMap[value]
  }
  // 翻译设施类型
  if (propName === 'amenity' && amenityTypeMap[value]) {
    return amenityTypeMap[value]
  }
  return value
}

/**
 * 翻译属性名
 * 将英文属性名翻译为中文标签
 * @param propName - 英文属性名
 * @returns 中文标签，如果没有对应翻译则返回原属性名
 */
export function translatePropertyLabel(propName: string): string {
  return propertyLabelMap[propName] || propName
}
