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
    console.error('[swagger] Failed to parse openapi.json, serving fallback spec. Error:', e)
    const fallbackSpec = {
      openapi: '3.0.3',
      info: { title: 'kuSystem Backend API (fallback)', version: '0.1.0' },
      servers: [{ url: process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:4001', description: 'Local dev' }],
      security: [{ TenantHeader: [] }],
      paths: {
        '/health': {
          get: { summary: 'Health check', security: [], responses: { '200': { description: 'OK' } } },
        },
        '/clients': {
          get: {
            summary: 'List clients',
            parameters: [
              { in: 'query', name: 'search', schema: { type: 'string' } },
              { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
              { in: 'query', name: 'pageSize', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of clients' } },
          },
          post: { summary: 'Create client', requestBody: { required: true }, responses: { '201': { description: 'Created' } } },
        },
        '/clients/{id}': {
          get: { summary: 'Get client', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Client' } } },
          put: { summary: 'Update client', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { required: true }, responses: { '200': { description: 'Updated' } } },
          delete: { summary: 'Delete client', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
        },
        '/clients/{clientId}/branches': {
          get: {
            summary: 'List branches by client',
            parameters: [
              { in: 'path', name: 'clientId', required: true, schema: { type: 'string' } },
              { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
              { in: 'query', name: 'pageSize', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of client branches' } },
          },
          post: { summary: 'Create client branch', parameters: [{ in: 'path', name: 'clientId', required: true, schema: { type: 'string' } }], requestBody: { required: true }, responses: { '201': { description: 'Created' } } },
        },
        '/client-branches/{id}': {
          get: { summary: 'Get branch', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Branch' } } },
          put: { summary: 'Update branch', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { required: true }, responses: { '200': { description: 'Updated' } } },
          delete: { summary: 'Delete branch', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
        },
        '/products': {
          get: {
            summary: 'List products',
            parameters: [
              { in: 'query', name: 'search', schema: { type: 'string' } },
              { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
              { in: 'query', name: 'pageSize', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of products' } },
          },
          post: { summary: 'Create product', requestBody: { required: true }, responses: { '201': { description: 'Created' } } },
        },
        '/products/{id}': {
          get: { summary: 'Get product', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Product' } } },
          put: { summary: 'Update product', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { required: true }, responses: { '200': { description: 'Updated' } } },
          delete: { summary: 'Delete product', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
        },
        '/quotes': {
          get: {
            summary: 'List quotes',
            parameters: [
              { in: 'query', name: 'search', schema: { type: 'string' } },
              { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
              { in: 'query', name: 'pageSize', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of quotes' } },
          },
          post: { summary: 'Create quote', requestBody: { required: true }, responses: { '201': { description: 'Created' } } },
        },
        '/quotes/{id}': {
          get: { summary: 'Get quote', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Quote' } } },
          put: { summary: 'Update quote', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { required: true }, responses: { '200': { description: 'Updated' } } },
          delete: { summary: 'Delete quote', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
        },
        '/public/quotes/{publicId}': {
          get: { summary: 'Get public quote by publicId', parameters: [{ in: 'path', name: 'publicId', required: true, schema: { type: 'string' } }], security: [], responses: { '200': { description: 'Public quote' }, '404': { description: 'Not found' } } },
        },
      },
      components: {
        securitySchemes: {
          TenantHeader: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Tenant-Id',
            description: 'Identificador numérico del tenant. Requerido en rutas privadas.',
          },
        },
      },
    }
    return swaggerUi.setup(fallbackSpec)(_req, res, next)
  }
})

export default router
