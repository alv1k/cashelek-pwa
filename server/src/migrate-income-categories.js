import pool from './db.js'

const RULES = [
  { match: /^такси$/i, category: 'такси' },
  { match: /^зп Айсен/i, category: 'зп Айсен' },
  { match: /^за Айсен/i, category: 'зп Айсен' },
  { match: /^зп Алена/i, category: 'зп Алена' },
  { match: /^аванс НВК/i, category: 'аванс НВК Саха' },
  { match: /^нвк саха$/i, category: 'зп НВК Саха' },
  { match: /^НВК Саха$/i, category: 'зп НВК Саха' },
  { match: /^больничный/i, category: 'зп Айсен' },
  { match: /^Помощь от родственников/i, category: 'зп Айсен' },
]

async function migrate() {
  const { rows } = await pool.query(
    "SELECT id, name, category FROM transactions WHERE category = 'доход'"
  )

  let updated = 0
  for (const row of rows) {
    const rule = RULES.find((r) => r.match.test(row.name.trim()))
    if (rule) {
      await pool.query('UPDATE transactions SET category = $1 WHERE id = $2', [rule.category, row.id])
      updated++
      console.log(`  "${row.name}" → ${rule.category}`)
    }
  }

  console.log(`\nUpdated ${updated} of ${rows.length} income transactions.`)
  process.exit(0)
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
