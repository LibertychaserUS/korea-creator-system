import { enActions } from '@libs/i18n/locales/kcs/common-en'
import { koCommon } from '@libs/i18n/locales/kcs/common-ko'
import { koKcs } from '@libs/i18n/locales/kcs/ko'

// A loader, not a bare object: static locale objects get precompiled and lose their imported parts.
// Korean has no `actions` of its own; the TinyShip locale inherits English ones too.
export default defineI18nLocale(() => ({ common: koCommon, actions: enActions, kcs: koKcs }))
