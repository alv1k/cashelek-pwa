const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://91.132.161.112:3080' : '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export interface Transaction {
  id: string
  name: string
  date: string
  price: number
  quantity: number
  amount: number
  category: string
  comment: string
}

export interface TransactionsResponse {
  data: Transaction[]
  total: number
}

export interface CategoryStat {
  category: string
  count: string
  total: string
}

export interface MonthlySummary {
  month: string
  category: string
  count: string
  total: string
}

export const api = {
  getTransactions(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<TransactionsResponse>(`/api/transactions${qs}`)
  },

  getTransaction(id: string) {
    return request<Transaction>(`/api/transactions/${id}`)
  },

  createTransaction(data: Omit<Transaction, 'id'>) {
    return request<Transaction>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateTransaction(id: string, data: Partial<Transaction>) {
    return request<Transaction>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteTransaction(id: string) {
    return request<{ ok: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' })
  },

  getCategories(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<CategoryStat[]>(`/api/categories${qs}`)
  },

  getSummary(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<MonthlySummary[]>(`/api/summary${qs}`)
  },

  suggestCategory(name: string) {
    return request<{ category: string }>(`/api/suggest-category?name=${encodeURIComponent(name)}`)
  },

  health() {
    return request<{ status: string }>('/api/health')
  },
}
