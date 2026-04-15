import { useEffect, useState, useCallback } from 'react'
import { api, type Transaction } from '../api'
import { formatMoney, formatDateShort } from '../utils'

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Add form
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getTransactions({ category: 'доход', limit: '200' })
      .then((res) => { if (!cancelled) { setIncomes(res.data); setTotal(res.total) } })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)

  function resetForm() {
    setName('')
    setDate(new Date().toISOString().slice(0, 10))
    setAmount('')
    setComment('')
    setEditId(null)
    setShowForm(false)
  }

  function startEdit(t: Transaction) {
    setName(t.name)
    setDate(t.date.slice(0, 10))
    setAmount(String(t.amount))
    setComment(t.comment)
    setEditId(t.id)
    setShowForm(true)
  }

  const handleSave = useCallback(async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        date,
        price: parseFloat(amount),
        quantity: 1,
        amount: parseFloat(amount),
        category: 'доход',
        comment,
      }
      if (editId) {
        await api.updateTransaction(editId, data)
      } else {
        await api.createTransaction(data)
      }
      resetForm()
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [name, date, amount, comment, editId])

  async function handleDelete(id: string) {
    try {
      await api.deleteTransaction(id)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Ошибка удаления')
    }
  }

  if (error) {
    return (
      <div className="page">
        <div className="card text-danger">Ошибка подключения: {error}</div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Total */}
      <div className="card">
        <p className="text-muted mb-1">Общий доход</p>
        <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-primary)' }}>
          {loading ? '...' : formatMoney(totalIncome)}
        </p>
        <p className="text-muted mt-2">{total} записей</p>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{editId ? 'Редактировать' : 'Новый доход'}</p>
            <button className="text-muted text-lg leading-none" onClick={resetForm}>x</button>
          </div>
          <input
            className="input"
            placeholder="Источник дохода"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Сумма"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <input
            className="input"
            placeholder="Комментарий"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            className="btn btn-primary w-full"
            disabled={!name.trim() || !amount || saving}
            onClick={handleSave}
          >
            {saving ? 'Сохраняю...' : editId ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {loading && incomes.length === 0 && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64 }} />
          ))
        )}
        {incomes.map((t) => (
          <div key={t.id} className="card-compact flex items-center gap-4 cursor-pointer" onClick={() => startEdit(t)}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.name}</p>
              <p className="text-muted mt-1">
                {formatDateShort(t.date)}
                {t.comment ? ` · ${t.comment}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0 flex items-center gap-3">
              <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                +{formatMoney(t.amount)}
              </p>
              <button
                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] text-sm transition-colors"
                onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showForm && (
        <button className="fab" onClick={() => setShowForm(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )
}
