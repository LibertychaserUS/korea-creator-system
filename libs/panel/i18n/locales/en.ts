import { enActions, enCommon } from '@libs/i18n/locales/kcs/common-en'
import { enKcs } from '@libs/i18n/locales/kcs/en'

// A loader, not a bare object: static locale objects get precompiled and lose their imported parts.
export default defineI18nLocale(() => ({ common: enCommon, actions: enActions, kcs: enKcs }))
