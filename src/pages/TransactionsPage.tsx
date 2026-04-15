import { useEffect, useState, useCallback } from 'react'
import { api, type Transaction, type CategoryStat } from '../api'
import AddTransactionModal from '../components/AddTransactionModal'
import EditTransactionModal from '../components/EditTransactionModal'
import Select from '../components/Select'

import { formatMoney, formatDateShort } from '../utils'

const LIMIT = 50

export default function TransactionsPage() {
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterCategory, setFilterCategory] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    api.getCategories()
      .then(setCategories)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params: Record<string, string> = { limit: String(LIMIT), offset: String(page * LIMIT), exclude_category: 'доход' }
    if (filterCategory) params.category = filterCategory
    if (search) params.search = search
    api.getTransactions(params)
      .then((res) => { if (!cancelled) { setTransactions(res.data); setTotal(res.total) } })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filterCategory, search, page, refreshKey])

  const handleSaved = useCallback(() => {
    setShowModal(false)
    setEditTransaction(null)
    setRefreshKey((k) => k + 1)
  }, [])

  if (error) {
    return (
      <div className="page">
        <div className="card text-danger">Ошибка подключения: {error}</div>
      </div>
    )
  }

  return (
    <div className="page">
      <input
        type="text"
        placeholder="Поиск..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        className="input"
      />
      <Select
        value={filterCategory}
        onChange={(v) => { setFilterCategory(v); setPage(0) }}
        placeholder="Все категории"
        options={categories.filter((c) => c.category !== 'доход').map((c) => ({ value: c.category, label: c.category }))}
      />

      <p className="text-muted">
        {loading ? 'Загрузка...' : `${total} записей`}
      </p>

      <div className="flex flex-col gap-2">
        {loading && transactions.length === 0 && (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 72, padding: 18 }}>
              <div className="flex items-center gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <div className="skeleton-text" style={{ width: '60%' }} />
                  <div className="skeleton-text" style={{ width: '40%', height: 10 }} />
                </div>
                <div className="skeleton-text" style={{ width: 60 }} />
              </div>
            </div>
          ))
        )}
        {transactions.map((t) => (
          <div key={t.id} className="card-compact flex items-center gap-4 cursor-pointer" onClick={() => setEditTransaction(t)}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.name}</p>
              <p className="text-muted mt-1">
                {formatDateShort(t.date)} · {t.category}
                {t.comment ? ` · ${t.comment}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums">{formatMoney(t.amount)}</p>
              {t.quantity !== 1 && (
                <p className="text-muted mt-0.5">
                  {t.quantity} x {formatMoney(t.price)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {total > LIMIT && (
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn btn-secondary disabled:opacity-30"
          >
            Назад
          </button>
          <span className="text-muted tabular-nums">
            {page + 1} / {Math.ceil(total / LIMIT)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * LIMIT >= total}
            className="btn btn-secondary disabled:opacity-30"
          >
            Вперёд
          </button>
        </div>
      )}

      <button className="fab" onClick={() => setShowModal(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {showModal && (
        <AddTransactionModal
          categories={categories.map((c) => c.category)}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editTransaction && (
        <EditTransactionModal
          transaction={editTransaction}
          categories={categories.map((c) => c.category)}
          onClose={() => setEditTransaction(null)}
          onSaved={handleSaved}
          onDeleted={handleSaved}
        />
      )}
    </div>
  )
}
