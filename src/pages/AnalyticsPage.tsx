import { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api, type CategoryStat, type MonthlySummary } from '../api'
import { formatMoney } from '../utils'
import Select from '../components/Select'

const COLORS = [
  '#3fb950', '#58a6ff', '#f85149', '#d29922', '#bc8cff',
  '#f778ba', '#39d2c0', '#db6d28', '#56d364', '#79c0ff',
  '#8b949e', '#ff7b72', '#a5d6ff', '#7ee787', '#d2a8ff',
  '#ffa657', '#f0883e', '#3ddbd9',
]

type Period = 'all' | 'month' | 'quarter' | 'year'

function getPeriodRange(period: Period, offset: number): { from?: string; to?: string; label: string } {
  if (period === 'all') return { label: 'Всё время' }

  const now = new Date()
  let start: Date
  let end: Date

  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
    const label = start.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    return { from: fmt(start), to: fmt(end), label }
  }

  if (period === 'quarter') {
    const currentQ = Math.floor(now.getMonth() / 3)
    const totalQ = currentQ + offset
    const year = now.getFullYear() + Math.floor(totalQ / 4)
    const qInYear = ((totalQ % 4) + 4) % 4
    start = new Date(year, qInYear * 3, 1)
    end = new Date(year, qInYear * 3 + 3, 0)
    return { from: fmt(start), to: fmt(end), label: `Q${qInYear + 1} ${year}` }
  }

  const year = now.getFullYear() + offset
  start = new Date(year, 0, 1)
  end = new Date(year, 11, 31)
  return { from: fmt(start), to: fmt(end), label: String(year) }
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function AnalyticsPage() {
  const [allCategories, setAllCategories] = useState<CategoryStat[]>([])
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [monthly, setMonthly] = useState<MonthlySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [period, setPeriod] = useState<Period>('month')
  const [offset, setOffset] = useState(0)
  const [filterCategory, setFilterCategory] = useState('')

  useEffect(() => {
    api.getCategories().then(setAllCategories).catch(() => {})
  }, [])

  const range = useMemo(() => getPeriodRange(period, offset), [period, offset])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params: Record<string, string> = {}
    if (range.from) params.from = range.from
    if (range.to) params.to = range.to
    if (filterCategory) params.category = filterCategory

    Promise.all([api.getCategories(params), api.getSummary(params)])
      .then(([cats, sum]) => {
        if (!cancelled) { setCategories(cats); setMonthly(sum) }
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [period, offset, filterCategory])

  // Split income vs expenses
  const incomeCategories = categories.filter((c) => c.category === 'доход')
  const expenseCategories = categories.filter((c) => c.category !== 'доход')

  const totalIncome = incomeCategories.reduce((s, c) => s + parseFloat(c.total), 0)
  const totalExpense = expenseCategories.reduce((s, c) => s + parseFloat(c.total), 0)
  const balance = totalIncome - totalExpense

  // Monthly data with income/expense split
  const monthlyData = Object.entries(
    monthly.reduce<Record<string, { income: number; expense: number }>>((acc, r) => {
      if (!acc[r.month]) acc[r.month] = { income: 0, expense: 0 }
      if (r.category === 'доход') {
        acc[r.month].income += parseFloat(r.total)
      } else {
        acc[r.month].expense += parseFloat(r.total)
      }
      return acc
    }, {})
  )
    .map(([month, data]) => ({ month, income: Math.round(data.income), expense: Math.round(data.expense) }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const pieData = expenseCategories.map((c) => ({
    name: c.category || 'без категории',
    value: Math.round(parseFloat(c.total)),
  }))

  if (error) {
    return (
      <div className="page">
        <div className="card text-danger">Ошибка подключения: {error}</div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Period */}
      <div className="tabs">
        {([['all', 'Всё'], ['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год']] as const).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${period === key ? 'tab-active' : ''}`}
            onClick={() => { setPeriod(key); setOffset(0) }}
          >
            {label}
          </button>
        ))}
      </div>

      {period !== 'all' && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" onClick={() => setOffset((o) => o - 1)}>‹</button>
          <span className="text-sm font-medium">{range.label}</span>
          <button
            className="btn btn-secondary"
            disabled={offset >= 0}
            onClick={() => setOffset((o) => o + 1)}
          >›</button>
        </div>
      )}

      {/* Category filter */}
      <Select
        value={filterCategory}
        onChange={setFilterCategory}
        placeholder="Все категории"
        options={allCategories.map((c) => ({ value: c.category, label: c.category }))}
      />

      {/* Loading */}
      {loading && (
        <>
          <div className="skeleton" style={{ height: 140 }} />
          <div className="skeleton" style={{ height: 300 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </>
      )}

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-muted mb-1">Доходы</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {formatMoney(totalIncome)}
            </p>
          </div>
          <div className="card">
            <p className="text-muted mb-1">Расходы</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>
              {formatMoney(totalExpense)}
            </p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card">
          <p className="text-muted mb-1">Баланс · {range.label}</p>
          <p
            className="text-3xl font-bold tracking-tight"
            style={{ color: balance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}
          >
            {balance >= 0 ? '+' : ''}{formatMoney(balance)}
          </p>
        </div>
      )}

      {/* Bar chart — income vs expense by month */}
      {!loading && monthlyData.length > 0 && (
        <div className="card">
          <h3 className="text-muted mb-4 font-medium">По месяцам</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <XAxis
                dataKey="month"
                tick={{ fill: '#8b949e', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(v, name) => [formatMoney(Number(v)), name === 'income' ? 'Доходы' : 'Расходы']}
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '8px 12px' }}
                labelStyle={{ color: '#f0f3f6' }}
              />
              <Legend
                formatter={(value: string) => value === 'income' ? 'Доходы' : 'Расходы'}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="income" fill="#3fb950" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" fill="#f85149" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie chart — expenses by category */}
      {!loading && pieData.length > 0 && (
        <div className="card">
          <h3 className="text-muted mb-4 font-medium">Расходы по категориям</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                strokeWidth={2}
                stroke="var(--color-bg)"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => formatMoney(Number(v))}
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '8px 12px' }}
                labelStyle={{ color: '#f0f3f6' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs py-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-muted">{d.name}</span>
                <span className="ml-auto font-medium tabular-nums">{formatMoney(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && pieData.length === 0 && monthlyData.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted text-sm">Нет данных за выбранный период</p>
        </div>
      )}
    </div>
  )
}
