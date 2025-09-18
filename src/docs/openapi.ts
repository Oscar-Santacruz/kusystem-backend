import { writeFileSync } from 'fs'
import { OpenApiGeneratorV3, OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  clientSchema,
  branchSchema,
  productSchema,
  quoteSchema,
  quoteItemSchema,
  additionalChargeSchema,
} from '../routes/schemas.js'

extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

// Schemas
const ClientInput = clientSchema.openapi('ClientInput')
const ClientInputPartial = clientSchema.partial().openapi('ClientInputPartial')
const Client = clientSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('Client')
registry.register('Client', Client)
registry.register('ClientInput', ClientInput)
registry.register('ClientInputPartial', ClientInputPartial)

const ClientBranchInput = branchSchema.openapi('ClientBranchInput')
const ClientBranchInputPartial = branchSchema.partial().openapi('ClientBranchInputPartial')
const ClientBranch = branchSchema.extend({
  id: z.string(),
  clientId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('ClientBranch')
registry.register('ClientBranch', ClientBranch)
registry.register('ClientBranchInput', ClientBranchInput)
registry.register('ClientBranchInputPartial', ClientBranchInputPartial)

const ProductInput = productSchema.openapi('ProductInput')
const ProductInputPartial = productSchema.partial().openapi('ProductInputPartial')
const Product = productSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('Product')
registry.register('Product', Product)
registry.register('ProductInput', ProductInput)
registry.register('ProductInputPartial', ProductInputPartial)

const QuoteItemInput = quoteItemSchema.openapi('QuoteItemInput')
const QuoteItem = quoteItemSchema.extend({ id: z.string().optional() }).openapi('QuoteItem')
registry.register('QuoteItem', QuoteItem)
registry.register('QuoteItemInput', QuoteItemInput)

const AdditionalCharge = additionalChargeSchema.openapi('AdditionalCharge')
registry.register('AdditionalCharge', AdditionalCharge)

const QuoteInput = quoteSchema.openapi('QuoteInput')
const QuoteInputPartial = quoteSchema.partial().openapi('QuoteInputPartial')
const Quote = quoteSchema.extend({
  id: z.string(),
  number: z.string().nullable().optional(),
  items: z.array(QuoteItem),
  additionalCharges: z.array(AdditionalCharge).optional(),
  subtotal: z.number().nullable().optional(),
  taxTotal: z.number().nullable().optional(),
  discountTotal: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
}).openapi('Quote')
registry.register('Quote', Quote)
registry.register('QuoteInput', QuoteInput)
registry.register('QuoteInputPartial', QuoteInputPartial)

// Paths
registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z.object({ ok: z.boolean() })
        }
      }
    }
  }
})

registry.registerPath({
  method: 'get',
  path: '/clients',
  summary: 'List clients',
  request: {
    query: z.object({
      search: z.string().optional(),
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
    })
  },
  responses: {
    200: {
      description: 'List of clients',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(Client),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          })
        }
      }
    }
  }
})

registry.registerPath({
  method: 'post',
  path: '/clients',
  summary: 'Create client',
  request: {
    body: {
      content: { 'application/json': { schema: ClientInput } }
    }
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: Client } }
    }
  }
})

registry.registerPath({
  method: 'get',
  path: '/clients/{id}',
  summary: 'Get client',
  request: {
    params: z.object({ id: z.string() })
  },
  responses: {
    200: {
      description: 'Client',
      content: { 'application/json': { schema: Client } }
    }
  }
})

registry.registerPath({
  method: 'put',
  path: '/clients/{id}',
  summary: 'Update client',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: ClientInputPartial } }
    }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: Client } }
    }
  }
})

registry.registerPath({
  method: 'delete',
  path: '/clients/{id}',
  summary: 'Delete client',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Deleted',
      content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }
    }
  }
})

registry.registerPath({
  method: 'get',
  path: '/clients/{clientId}/branches',
  summary: 'List branches by client',
  request: {
    params: z.object({ clientId: z.string() }),
    query: z.object({
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
    })
  },
  responses: {
    200: {
      description: 'List of client branches',
      content: { 'application/json': { schema: z.object({ data: z.array(ClientBranch), total: z.number(), page: z.number(), pageSize: z.number() }) } }
    }
  }
})

registry.registerPath({
  method: 'post',
  path: '/clients/{clientId}/branches',
  summary: 'Create client branch',
  request: {
    params: z.object({ clientId: z.string() }),
    body: { content: { 'application/json': { schema: ClientBranchInput } } }
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: ClientBranch } }
    }
  }
})

registry.registerPath({
  method: 'get',
  path: '/client-branches/{id}',
  summary: 'Get branch',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Branch',
      content: { 'application/json': { schema: ClientBranch } }
    }
  }
})

registry.registerPath({
  method: 'put',
  path: '/client-branches/{id}',
  summary: 'Update branch',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ClientBranchInputPartial } } }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: ClientBranch } }
    }
  }
})

registry.registerPath({
  method: 'delete',
  path: '/client-branches/{id}',
  summary: 'Delete branch',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Deleted',
      content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }
    }
  }
})

registry.registerPath({
  method: 'get',
  path: '/products',
  summary: 'List products',
  request: {
    query: z.object({
      search: z.string().optional(),
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
    })
  },
  responses: {
    200: {
      description: 'List of products',
      content: { 'application/json': { schema: z.object({ data: z.array(Product), total: z.number(), page: z.number(), pageSize: z.number() }) } }
    }
  }
})

registry.registerPath({
  method: 'post',
  path: '/products',
  summary: 'Create product',
  request: { body: { content: { 'application/json': { schema: ProductInput } } } },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: Product } } } }
})

registry.registerPath({
  method: 'get',
  path: '/products/{id}',
  summary: 'Get product',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Product', content: { 'application/json': { schema: Product } } } }
})

registry.registerPath({
  method: 'put',
  path: '/products/{id}',
  summary: 'Update product',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ProductInputPartial } } }
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: Product } } } }
})

registry.registerPath({
  method: 'delete',
  path: '/products/{id}',
  summary: 'Delete product',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } } } }
})

registry.registerPath({
  method: 'get',
  path: '/quotes',
  summary: 'List quotes',
  request: {
    query: z.object({
      search: z.string().optional(),
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
    })
  },
  responses: {
    200: {
      description: 'List of quotes',
      content: { 'application/json': { schema: z.object({ data: z.array(Quote), total: z.number(), page: z.number(), pageSize: z.number() }) } }
    }
  }
})

registry.registerPath({
  method: 'post',
  path: '/quotes',
  summary: 'Create quote',
  request: { body: { content: { 'application/json': { schema: QuoteInput } } } },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: Quote } } } }
})

registry.registerPath({
  method: 'get',
  path: '/quotes/{id}',
  summary: 'Get quote',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Quote', content: { 'application/json': { schema: Quote } } } }
})

registry.registerPath({
  method: 'put',
  path: '/quotes/{id}',
  summary: 'Update quote',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: QuoteInputPartial } } }
  },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: Quote } } } }
})

registry.registerPath({
  method: 'delete',
  path: '/quotes/{id}',
  summary: 'Delete quote',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } } } }
})

const generator = new OpenApiGeneratorV3(registry.definitions)
const doc = generator.generateDocument({
  openapi: '3.0.3',
  info: { title: 'kuSystem Backend API', version: '0.1.0' },
  servers: [{ url: 'http://localhost:4000', description: 'Local dev' }],
})

writeFileSync(new URL('./openapi.json', import.meta.url), JSON.stringify(doc, null, 2))
