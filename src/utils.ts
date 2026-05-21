export function formatMoney(n: number | string) {
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
}

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
]

export function formatDateShort(dateStr: string): string {
  // Handles both "2026-04-14" and ISO "2026-04-14T00:00:00.000Z"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = d.getDate()
  const month = MONTHS_SHORT[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}
