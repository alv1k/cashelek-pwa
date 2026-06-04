const getApiUrl = () => {
  // If we're on Vercel (production), ALWAYS use the proxy (relative path)
  // This avoids Mixed Content and SSL errors.
  if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
    return ''
  }

  // Local development
  return import.meta.env.VITE_API_URL || 'http://91.132.161.112:3080'
}

const API_URL = getApiUrl()

let authToken = localStorage.getItem('token')

export const setToken = (token: string | null) => {
  authToken = token
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export interface User {
  id: string
  email: string
  name?: string
  role?: string
}

export interface AdminUserStat extends User {
  created_at: string
  transaction_count: string
  total_amount: string
  last_activity: string | null
}

export interface AuthResponse {
  token: string
  user: User
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

  parseReceipt(text: string) {
    return request<{ items: Array<{ name: string; price: number; quantity: number }> }>('/api/parse-receipt', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  },

  login(data: any) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  register(data: any) {
    return request<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getMe() {
    return request<User>('/api/auth/me')
  },

  getAdminUsers() {
    return request<AdminUserStat[]>('/api/admin/users')
  },

  health() {
    return request<{ status: string }>('/api/health')
  },
}
