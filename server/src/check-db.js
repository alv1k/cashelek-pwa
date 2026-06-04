import pool from './db.js'

async function check() {
  const { rows } = await pool.query(
    "SELECT category, COUNT(*) FROM transactions GROUP BY category"
  )
  console.log('Categories in DB:')
  console.table(rows)
  
  const { rows: incomeRows } = await pool.query(
    "SELECT id, name, category FROM transactions WHERE category = 'доход' LIMIT 10"
  )
  console.log('Sample "доход" transactions:')
  console.table(incomeRows)
  
  process.exit(0)
}

check().catch(err => {
  console.error(err)
  process.exit(1)
})
