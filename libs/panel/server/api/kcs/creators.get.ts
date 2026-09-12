import { listCreatorRows } from '@libs/kcs-domain'

export default defineEventHandler(() => {
  return {
    items: listCreatorRows(),
  }
})
