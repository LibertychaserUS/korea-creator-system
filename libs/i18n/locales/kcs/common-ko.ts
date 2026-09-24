/** Korean `common` / `actions`: the few shared words the 听潮 panel shows (the TinyShip locale ../ko.ts reuses them). */
import { enCommon } from './common-en'

export const koCommon = {
  ...enCommon,
  welcome: "听潮에 오신 것을 환영합니다",
  siteName: "听潮",
  loading: "불러오는 중…",
  unexpectedError: "예기치 않은 오류가 발생했습니다",
  notAvailable: "없음",
  theme: {
    ...enCommon.theme,
    light: "라이트",
    dark: "다크",
    system: "시스템",
    toggle: "테마 전환",
    appearance: "표시",
  },
} as const
