/**
 * Copy for the ops console pages, storage card, shortlist and display notes.
 * One module per language (kcs/console-<code>.ts) so an app loading one
 * language never pulls in the others; each locale spreads its part into `kcs`.
 */
import { kcsConsoleEn } from './kcs/console-en'
import { kcsConsoleKo } from './kcs/console-ko'
import { kcsConsoleZhCN } from './kcs/console-zh-CN'

export { kcsConsoleEn, kcsConsoleKo, kcsConsoleZhCN }
export const kcsConsoleCopy = { 'zh-CN': kcsConsoleZhCN, en: kcsConsoleEn, ko: kcsConsoleKo }
