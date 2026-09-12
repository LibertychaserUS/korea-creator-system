/**
 * Demo fixtures — shown ONLY when the API returns an empty list, so the
 * panel stays clickable before seed data lands. Every consumer must mark
 * these rows as demo (kcs.prefs.demo) and must not mutate them.
 */

export interface DemoCreator {
  id: string
  creatorKey: string
  displayName: string
  xhsId: string
  followers: number
  categories: string[]
  grade: 'A' | 'B' | 'C' | 'D'
  final: number
  price: { amountMin: number; currency: 'CNY' }
  status: 'released'
  demo: true
}

const NAMES: Array<[string, string]> = [
  ['김서연', 'seoyeon_daily'],
  ['이지우', 'jiwoo.seoul'],
  ['박민준', 'minjun_street'],
  ['최수아', 'sua.makes'],
  ['정하늘', 'haneul_table'],
  ['강태오', 'taeo.fit'],
  ['윤채원', 'chaewon glow'],
  ['신동혁', 'donghyuk_tech'],
  ['한예슬', 'yeseul.home'],
  ['오준석', 'junseok_eats'],
  ['임소윤', 'soyun.style'],
  ['송민재', 'minjae_plays'],
  ['권은비', 'eunbi.skin'],
  ['홍지훈', 'jihoon_reads'],
  ['배수민', 'sumin.travel'],
  ['문채린', 'chaerin.nails'],
  ['유성민', 'sungmin_coffee'],
  ['장우진', 'woojin.cycles'],
  ['전보람', 'boram_bakes'],
  ['노하린', 'harin.paints'],
  ['심재경', 'jaekyung.films'],
  ['양다은', 'daeun.plants'],
  ['마준혁', 'junhyuk_sneakers'],
  ['고민서', 'minseo.yoga'],
]

function seeded(index: number, min: number, max: number): number {
  // Deterministic pseudo-random so SSR and client render identical rows.
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return Math.round(min + (x - Math.floor(x)) * (max - min))
}

export const DEMO_CREATORS: DemoCreator[] = NAMES.map(([displayName, xhsId], i) => {
  const followers = seeded(i, 8_000, 1_200_000)
  const final = seeded(i + 40, 42, 96)
  const grade = final >= 85 ? 'A' : final >= 70 ? 'B' : final >= 55 ? 'C' : 'D'
  return {
    id: `demo-creator-${i + 1}`,
    creatorKey: `demo:${xhsId}`,
    displayName,
    xhsId,
    followers,
    categories: [i % 3 === 0 ? 'never_collaborated' : 'collaborated'],
    grade,
    final,
    price: { amountMin: seeded(i + 80, 2_000, 80_000), currency: 'CNY' },
    status: 'released',
    demo: true,
  }
})

export interface DemoProject {
  id: string
  name: string
  note: string
  member_count: number
  demo: true
}

export const DEMO_PROJECTS: DemoProject[] = [
  { id: 'demo-project-1', name: '2026 가을 스킨케어 캠페인', note: 'demo', member_count: 6, demo: true },
  { id: 'demo-project-2', name: '성수동 팝업 스토어', note: 'demo', member_count: 4, demo: true },
  { id: 'demo-project-3', name: '신규 스니커즈 라인', note: 'demo', member_count: 5, demo: true },
]

export function demoAssignments(projectId: string) {
  const offset = projectId === 'demo-project-2' ? 6 : projectId === 'demo-project-3' ? 12 : 0
  return DEMO_CREATORS.slice(offset, offset + 5).map((c, i) => ({
    creatorId: c.id,
    creatorKey: c.creatorKey,
    displayName: c.displayName,
    grade: c.grade,
    final: c.final,
    rank: i + 1,
    followers: c.followers,
    price: c.price,
    status: 'assigned',
    demo: true as const,
  }))
}

export interface DemoJob {
  id: string
  status: string
  written_count: number
  demo: true
}

export const DEMO_JOBS: DemoJob[] = [
  { id: 'demo-job-1042', status: 'ready', written_count: 318, demo: true },
  { id: 'demo-job-1041', status: 'ready', written_count: 285, demo: true },
  { id: 'demo-job-1040', status: 'failed', written_count: 12, demo: true },
  { id: 'demo-job-1039', status: 'ready', written_count: 402, demo: true },
  { id: 'demo-job-1038', status: 'running', written_count: 167, demo: true },
]
