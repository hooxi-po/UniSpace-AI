import { readBuildingsDB } from '~/server/utils/buildings-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = query.type as string | undefined
  const bDb = await readBuildingsDB()

  let rooms = bDb.rooms
  if (type && type !== 'all') {
    rooms = rooms.filter(r => r.type === type)
  } else {
    // 默认返回公寓和宿舍相关
    rooms = rooms.filter(r => r.type === 'TeacherApartment' || r.type === 'Student')
  }

  return {
    source: 'mock-derived',
    rooms: rooms.map(r => ({
      ...r,
      // 适配公寓模块可能需要的额外字段
      monthlyRent: r.type === 'TeacherApartment' ? 800 : 200,
      deposit: r.type === 'TeacherApartment' ? 1600 : 400,
      facilities: ['空调', '热水器', '床', '衣柜'],
      layout: r.type === 'TeacherApartment' ? '一室一厅' : '四人间'
    }))
  }
})


