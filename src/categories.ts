export const INCOME_CATEGORIES = [
  'доход',
  'такси',
  'зп Айсен',
  'зп Алена',
  'аванс НВК Саха',
  'зп НВК Саха',
] as const

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]

export function isIncomeCategory(category: string): boolean {
  return (INCOME_CATEGORIES as readonly string[]).includes(category)
}
