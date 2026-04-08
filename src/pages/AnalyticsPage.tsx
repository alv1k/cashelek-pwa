import { useEffect, useState, useMemo } from 'react'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveBar } from '@nivo/bar'
import { api, type CategoryStat, type MonthlySummary } from '../api'
import { formatMoney } from '../utils'
import Select from '../components/Select'

const COLORS = [
  '#3fb950', '#58a6ff', '#f85149', '#d29922', '#bc8cff',
  '#f778ba', '#39d2c0', '#db6d28', '#56d364', '#79c0ff',
  '#8b949e', '#ff7b72', '#a5d6ff', '#7ee787', '#d2a8ff',
  '#ffa657', '#f0883e', '#3ddbd9',
]

const nivoTheme = {
  text: { fill: '#8b949e', fontSize: 12 },
  tooltip: {
    container: {
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 12,
      padding: '10px 14px',
      fontSize: 13,
      color: '#f0f3f6',
    },
  },
  grid: { line: { stroke: '#21262d', strokeWidth: 1 } },
  axis: {
    ticks: { text: { fill: '#8b949e', fontSize: 11 } },
    legend: { text: { fill: '#8b949e' } },
  },
  legends: { text: { fill: '#8b949e', fontSize: 12 } },
}

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

  const incomeCategories = categories.filter((c) => c.category === 'доход')
  const expenseCategories = categories.filter((c) => c.category !== 'доход')

  const totalIncome = incomeCategories.reduce((s, c) => s + parseFloat(c.total), 0)
  const totalExpense = expenseCategories.reduce((s, c) => s + parseFloat(c.total), 0)
  const balance = totalIncome - totalExpense

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
    .map(([month, data]) => ({
      month,
      Доходы: Math.round(data.income),
      Расходы: Math.round(data.expense),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const pieData = expenseCategories.map((c, i) => ({
    id: c.category || 'без категории',
    label: c.category || 'без категории',
    value: Math.round(parseFloat(c.total)),
    color: COLORS[i % COLORS.length],
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

      <Select
        value={filterCategory}
        onChange={setFilterCategory}
        placeholder="Все категории"
        options={allCategories.map((c) => ({ value: c.category, label: c.category }))}
      />

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

      {/* Bar chart */}
      {!loading && monthlyData.length > 0 && (
        <div className="card">
          <h3 className="text-muted mb-4 font-medium">По месяцам</h3>
          <div style={{ height: 240 }}>
            <ResponsiveBar
              data={monthlyData}
              keys={['Доходы', 'Расходы']}
              indexBy="month"
              groupMode="grouped"
              margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
              padding={0.3}
              borderRadius={6}
              colors={['#3fb950', '#f85149']}
              theme={nivoTheme}
              enableGridY={false}
              enableLabel={false}
              axisLeft={null}
              axisBottom={{
                tickSize: 0,
                tickPadding: 10,
              }}
              tooltip={({ id, value, color }) => (
                <div style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                  <span style={{ color: '#f0f3f6', fontSize: 13 }}>{id}: {formatMoney(value)}</span>
                </div>
              )}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'top-right',
                  direction: 'row',
                  translateY: -10,
                  itemWidth: 80,
                  itemHeight: 20,
                  symbolSize: 10,
                  symbolShape: 'circle',
                },
              ]}
              motionConfig="gentle"
            />
          </div>
        </div>
      )}

      {/* Pie chart */}
      {!loading && pieData.length > 0 && (
        <div className="card">
          <h3 className="text-muted mb-4 font-medium">Расходы по категориям</h3>
          <div style={{ height: 260 }}>
            <ResponsivePie
              data={pieData}
              colors={pieData.map((d) => d.color)}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              innerRadius={0.55}
              padAngle={1.5}
              cornerRadius={4}
              borderWidth={0}
              activeOuterRadiusOffset={6}
              theme={nivoTheme}
              enableArcLinkLabels={false}
              enableArcLabels={false}
              tooltip={({ datum }) => (
                <div style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: datum.color }} />
                  <span style={{ color: '#f0f3f6', fontSize: 13 }}>{datum.label}: {formatMoney(datum.value)}</span>
                </div>
              )}
              motionConfig="gentle"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {pieData.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs py-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: d.color }}
                />
                <span className="truncate text-muted">{d.label}</span>
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
