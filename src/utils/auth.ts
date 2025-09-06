import type { Request } from 'express'

export type CurrentUser = {
  id: string
  email?: string | null
  name?: string | null
  authProviderId?: string | null
}

// DEV ONLY: simple extractor. In producción integrar Auth0/JWT.
export function getCurrentUser(req: Request): CurrentUser | null {
  const id = (req.headers['x-user-id'] as string) || (req.headers['x-user-sub'] as string)
  const email = req.headers['x-user-email'] as string | undefined
  const name = req.headers['x-user-name'] as string | undefined
  const authProviderId = (req.headers['x-user-sub'] as string) || undefined
  if (!id && !authProviderId) return null
  return {
    id: id || authProviderId!,
    email: email ?? null,
    name: name ?? null,
    authProviderId: authProviderId ?? null,
  }
}
