import type { Request, Response, NextFunction } from 'express'

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.header('X-Tenant-Id') ?? req.header('x-tenant-id')
  if (!header) {
    return res.status(400).json({ error: 'Falta cabecera X-Tenant-Id' })
  }
  let tenantBigInt: bigint
  try {
    tenantBigInt = BigInt(header)
  } catch {
    return res.status(400).json({ error: 'X-Tenant-Id inválido (formato no numérico)' })
  }
  if (tenantBigInt <= 0n) {
    return res.status(400).json({ error: 'X-Tenant-Id inválido (debe ser entero positivo)' })
  }
  // Guardamos en locals
  ;(res.locals as any).tenantId = tenantBigInt
  next()
}

export function getTenantId(res: Response): bigint {
  const v = (res.locals as any).tenantId
  if (typeof v === 'bigint') return v
  throw new Error('tenantId no resuelto en el request')
}
