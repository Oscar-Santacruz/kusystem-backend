import { z } from 'zod'

export const productSchema = z.object({
  sku: z.string().max(100).optional().nullable(),
  name: z.string().min(1),
  unit: z.string().max(50).optional().nullable(),
  price: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1).optional().nullable(),
  priceIncludesTax: z.boolean().optional().default(false),
})

export const clientSchema = z.object({
  name: z.string().min(1),
  taxId: z.string().max(100).optional().nullable(),
  phone: z.string().max(100).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
})

export const branchSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
})

export const quoteItemSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional().nullable(),
  taxRate: z.number().min(0).max(1).optional().nullable(),
})

export const additionalChargeSchema = z.object({
  type: z.string().min(1),
  amount: z.number().nonnegative(),
})

export const quoteSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional().nullable(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(1),
  branchId: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  issueDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  printNotes: z.boolean().optional().nullable(),
  items: z.array(quoteItemSchema).default([]),
  additionalCharges: z.array(additionalChargeSchema).default([]).optional(),
})
