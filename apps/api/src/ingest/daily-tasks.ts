/**
 * The daily tasks this process runs (see `./daily`). Other modules add theirs
 * with one line here, e.g. `registerDailyTask('capacity', runDailyCapacitySnapshot)`.
 */
import { runDataStatus } from './data-status'
import { registerDailyTask } from './daily'
import { runScheduler } from './scheduler'
import { runValueTiers } from './tiering'

registerDailyTask('value-tiers', (env) => runValueTiers(env))
registerDailyTask('scheduler', (env) => runScheduler(env))
registerDailyTask('data-status', (env) => runDataStatus(env))
