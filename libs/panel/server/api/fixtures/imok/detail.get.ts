export default defineEventHandler(async () => {
  try {
    const rows = readImokCsv('IMOK-pink-influencer-detail.csv')
    // Pivot long table → per-creator sections: { [短名]: { [栏目]: [{字段, 内容, 数值, 单位, 来源}] } }
    const byCreator: Record<string, Record<string, Array<Record<string, string>>>> = {}
    for (const r of rows) {
      const who = r['短名'] || r['姓名']
      if (!who || who === '总览') continue
      const section = r['栏目'] || '说明'
      byCreator[who] ||= {}
      byCreator[who][section] ||= []
      byCreator[who][section].push({
        field: r['字段'] || '',
        content: r['内容'] || '',
        value: r['数值'] || '',
        unit: r['单位'] || '',
        source: r['来源'] || '',
      })
    }
    return { org: 'IMOK', sample: true, creators: byCreator }
  } catch {
    return { org: 'IMOK', sample: true, creators: {}, unavailable: true }
  }
})
