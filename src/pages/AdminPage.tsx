import { useEffect, useState } from 'react'
import { api, type AdminUserStat } from '../api'
import { formatMoney, formatDateShort } from '../utils'

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUserStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page p-4 flex flex-col gap-4">
        <div className="skeleton h-24" />
        <div className="skeleton h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page p-4">
        <div className="card text-danger">Ошибка: {error}</div>
      </div>
    )
  }

  return (
    <div className="page p-4 space-y-4">
      <div className="card">
        <h2 className="text-xl font-bold mb-1 text-[var(--color-text)]">Управление пользователями</h2>
        <p className="text-sm text-muted">Всего зарегистрировано: {users.length}</p>
      </div>

      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <div key={u.id} className="card-compact p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-[var(--color-text)]">{u.name || 'Без имени'}</p>
                <p className="text-xs text-muted">{u.email}</p>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-[var(--color-primary-dark)] text-white' : 'bg-[var(--color-surface-light)] text-muted'}`}>
                {u.role}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-surface-light)]">
              <div>
                <p className="text-[10px] text-muted uppercase">Транзакции</p>
                <p className="text-sm font-semibold">{u.transaction_count}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase">Оборот</p>
                <p className="text-sm font-semibold">{formatMoney(u.total_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase">Регистрация</p>
                <p className="text-sm">{formatDateShort(u.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase">Активность</p>
                <p className="text-sm">{u.last_activity ? formatDateShort(u.last_activity) : 'Нет данных'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
