import type { Quote, QuoteItem, QuoteAdditionalCharge, Prisma } from '@prisma/client'

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  const asNumber = Number(value as any)
  return Number.isFinite(asNumber) ? asNumber : null
}

export interface PublicQuoteItem {
  id: string
  description: string
  quantity: number | null
  unitPrice: number | null
  discount: number | null
  taxRate: number | null
}

export interface PublicAdditionalCharge {
  id: string
  type: string
  amount: number | null
}

export interface PublicQuote {
  id: string
  number: string | null
  status: string | null
  customerName: string
  branchName: string | null
  issueDate: Date | null
  dueDate: Date | null
  currency: string | null
  notes: string | null
  printNotes: boolean | null
  subtotal: number | null
  taxTotal: number | null
  discountTotal: number | null
  total: number | null
  items: PublicQuoteItem[]
  additionalCharges: PublicAdditionalCharge[]
}

export function sanitizeQuote(q: Quote & { items: QuoteItem[]; additionalCharges: QuoteAdditionalCharge[] }): PublicQuote {
  return {
    id: q.id,
    number: q.number ?? null,
    status: q.status ?? null,
    customerName: q.customerName,
    branchName: q.branchName ?? null,
    issueDate: q.issueDate ?? null,
    dueDate: q.dueDate ?? null,
    currency: q.currency ?? null,
    notes: q.notes ?? null,
    printNotes: q.printNotes ?? null,
    subtotal: toNumber(q.subtotal as any),
    taxTotal: toNumber(q.taxTotal as any),
    discountTotal: toNumber(q.discountTotal as any),
    total: toNumber(q.total as any),
    items: q.items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: toNumber(it.quantity as any),
      unitPrice: toNumber(it.unitPrice as any),
      discount: toNumber(it.discount as any),
      taxRate: toNumber(it.taxRate as any),
    })),
    additionalCharges: q.additionalCharges.map((ac) => ({
      id: ac.id,
      type: ac.type,
      amount: toNumber(ac.amount as any),
    })),
  }
}
