import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { readFileSync } from 'node:fs'
import type { Request, Response, NextFunction } from 'express'

const router = express.Router()

function loadOpenApi() {
  const url = new URL('./openapi.json', import.meta.url)
  const json = readFileSync(url, 'utf-8')
  return JSON.parse(json)
}

router.use('/', swaggerUi.serve, (_req: Request, res: Response, next: NextFunction) => {
  try {
    const spec = loadOpenApi()
    return swaggerUi.setup(spec)(_req, res, next)
  } catch (e) {
    return next(e)
  }
})

export default router
