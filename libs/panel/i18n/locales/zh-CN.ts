import { zhCNActions, zhCNCommon } from '@libs/i18n/locales/kcs/common-zh-CN'
import { zhCNKcs } from '@libs/i18n/locales/kcs/zh-CN'

// A loader, not a bare object: static locale objects get precompiled and lose their imported parts.
export default defineI18nLocale(() => ({ common: zhCNCommon, actions: zhCNActions, kcs: zhCNKcs }))
