import { createRequire } from 'module'
import 'dotenv/config'
import * as Sentry from '@sentry/node'

process.env.NEW_RELIC_CONFIG_FILENAME = 'newrelic.cjs'
const require = createRequire(import.meta.url)
const newrelic = require('newrelic')

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
})

export { Sentry, newrelic }
