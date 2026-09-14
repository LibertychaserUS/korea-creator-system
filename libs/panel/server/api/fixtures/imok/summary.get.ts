export default defineEventHandler(async () => {
  try {
    const rows = readImokCsv('IMOK-pink-summary.csv')
    return { org: 'IMOK', sample: true, items: rows }
  } catch {
    return { org: 'IMOK', sample: true, items: [], unavailable: true }
  }
})
