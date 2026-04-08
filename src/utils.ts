export function formatMoney(n: number | string) {
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
}
