export interface OrgInfo {
  id: string
  name: string
}

/**
 * Current company (tenant). The seeded platform org stands in for the sample
 * company IMOK until org-scoped API routes land; everything shown for it is
 * tenant-isolated by the API.
 */
export function useOrg() {
  const { user } = useSession()
  const org = computed<OrgInfo | null>(() => {
    if (!user.value) return null
    const id = user.value.orgId || 'org_platform'
    return { id, name: id === 'org_platform' ? 'IMOK' : id }
  })
  return { org }
}
