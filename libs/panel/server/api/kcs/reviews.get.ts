import { listCreatorRows } from '@libs/kcs-domain'

export default defineEventHandler(() => {
  const items = listCreatorRows()
    .filter(row => row.aiReview)
    .map(row => ({
      creator: row.creator,
      score: row.score,
      aiReview: row.aiReview,
      manualReview: row.manualReview,
    }))

  return { items }
})
