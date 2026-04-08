import pool from './db.js'

const schema = `
CREATE TABLE IF NOT EXISTS transactions (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  date     DATE NOT NULL,
  price    NUMERIC(10,2),
  quantity NUMERIC(10,3),
  amount   NUMERIC(10,2),
  category TEXT DEFAULT '',
  comment  TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
`

try {
  await pool.query(schema)
  console.log('Migration complete')
} catch (err) {
  console.error('Migration failed:', err.message)
} finally {
  await pool.end()
}
