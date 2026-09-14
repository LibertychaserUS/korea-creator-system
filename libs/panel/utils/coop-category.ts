export type CoopSlug = 'collaborated' | 'never_collaborated'

export function selectCoop(_current: string, slug: CoopSlug): CoopSlug {
  return slug
}

export function coopPressed(current: string, slug: CoopSlug): 'true' | 'false' {
  return current === slug ? 'true' : 'false'
}
