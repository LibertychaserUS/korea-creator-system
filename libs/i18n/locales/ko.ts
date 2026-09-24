import { en } from './en'
import { koCommon } from './kcs/common-ko'
import { koKcs } from './kcs/ko'
import type { Locale } from './types'

export const ko: Locale = {
  ...en,
  common: koCommon,
  header: {
    ...en.header,
    language: {
      switchLanguage: "언어 변경",
      english: "English",
      chinese: "中文",
      korean: "한국어",
    },
  },
  kcs: koKcs,
}
