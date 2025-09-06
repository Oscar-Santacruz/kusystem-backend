import { describe, it, expect } from 'vitest'
import { sanitizeQuote } from './sanitize'

describe('sanitizeQuote', () => {
  it('converts string numbers to numbers and keeps nulls', () => {
    const quote: any = {
      id: 'q1',
      number: '001',
      status: null,
      customerName: 'ACME',
      branchName: null,
      issueDate: null,
      dueDate: null,
      currency: 'USD',
      notes: null,
      printNotes: null,
      subtotal: '100.50',
      taxTotal: '10.05',
      discountTotal: null,
      total: '110.55',
      items: [
        {
          id: 'i1',
          description: 'Item 1',
          quantity: '2',
          unitPrice: '50.25',
          discount: '0',
          taxRate: '0.1',
        },
      ],
      additionalCharges: [
        { id: 'a1', type: 'shipping', amount: '5' },
      ],
    }

    const sanitized = sanitizeQuote(quote)

    expect(sanitized.subtotal).toBe(100.5)
    expect(sanitized.taxTotal).toBe(10.05)
    expect(sanitized.discountTotal).toBeNull()
    expect(sanitized.items[0].quantity).toBe(2)
    expect(sanitized.items[0].unitPrice).toBe(50.25)
    expect(sanitized.additionalCharges[0].amount).toBe(5)
  })
})
