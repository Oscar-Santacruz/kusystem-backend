import { Sentry, newrelic } from './instrumentation'
import express from 'express'
import cors from 'cors'
import clientsRouter from './routes/clients'
import productsRouter from './routes/products'
import quotesRouter from './routes/quotes'
import { clientBranchesByClient, clientBranchesRouter } from './routes/clientBranches'
import swaggerRouter from './docs/swagger'
import publicRouter from './routes/public'

const app = express()
app.use(Sentry.Handlers.requestHandler())

const envOrigins = (process.env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
const defaultOrigins = ['https://kusystem.ddns.net']
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]))
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
}))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/clients', clientsRouter)
app.use('/clients', clientBranchesByClient) // /clients/:clientId/branches
app.use('/client-branches', clientBranchesRouter)
app.use('/products', productsRouter)
app.use('/quotes', quotesRouter)
app.use('/public', publicRouter)
app.use('/docs', swaggerRouter)

app.use(Sentry.Handlers.errorHandler())
// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  newrelic.noticeError(err)
  console.error(err)
  const status = typeof err?.status === 'number' ? err.status : 500
  const message = err instanceof Error ? err.message : 'Internal Server Error'
  res.status(status).json({ error: message })
})

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {
  newrelic.recordCustomEvent('server-start', { port })
  Sentry.captureMessage(`Server started on port ${port}`)
  console.log(`API listening on http://localhost:${port}`)
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`)
})
