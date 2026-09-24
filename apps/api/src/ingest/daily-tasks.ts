/**
 * The daily tasks this process runs (see `./daily`). Other modules add theirs
 * with one line here, e.g. `registerDailyTask('capacity', runDailyCapacitySnapshot)`.
 */
import { registerDailyTask } from './daily'
import { runValueTiers } from './tiering'

registerDailyTask('value-tiers', (env) => runValueTiers(env))
