import { getOverview } from '@libs/kcs-domain'

export default defineEventHandler(() => {
  return getOverview()
})
