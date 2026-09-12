export default defineEventHandler(async () => {
  try {
    const rows = readImokCsv('IMOK-pink-chart-data.csv')
    const items = rows.map(r => ({
      id: r['图号'],
      title: r['图名'],
      type: r['图类型'],
      object: r['对象'],
      category: r['分类或日期'],
      series: r['系列'],
      value: Number(r['数值']),
      unit: r['单位'],
      note: r['口径说明'],
    }))
    return { org: 'IMOK', sample: true, items }
  } catch {
    return { org: 'IMOK', sample: true, items: [], unavailable: true }
  }
})
