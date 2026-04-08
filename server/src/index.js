import express from 'express'
import cors from 'cors'
import pool from './db.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch {
    res.status(500).json({ status: 'error', message: 'DB connection failed' })
  }
})

// Get all transactions (with optional filters)
app.get('/api/transactions', async (req, res) => {
  try {
    const { category, from, to, search, limit = 100, offset = 0 } = req.query
    const conditions = []
    const params = []
    let i = 1

    if (category) {
      conditions.push(`category = $${i++}`)
      params.push(category)
    }
    if (from) {
      conditions.push(`date >= $${i++}`)
      params.push(from)
    }
    if (to) {
      conditions.push(`date <= $${i++}`)
      params.push(to)
    }
    if (search) {
      conditions.push(`name ILIKE $${i++}`)
      params.push(`%${search}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(parseInt(limit), parseInt(offset))

    const { rows } = await pool.query(
      `SELECT * FROM transactions ${where} ORDER BY date DESC, id LIMIT $${i++} OFFSET $${i++}`,
      params
    )
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM transactions ${where}`,
      params.slice(0, -2)
    )

    res.json({ data: rows, total: parseInt(countRows[0].count) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get single transaction
app.get('/api/transactions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { id, name, date, price, quantity, amount, category, comment } = req.body
    const { rows } = await pool.query(
      `INSERT INTO transactions (id, name, date, price, quantity, amount, category, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id || crypto.randomUUID(), name, date, price, quantity, amount, category, comment || '']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { name, date, price, quantity, amount, category, comment } = req.body
    const { rows } = await pool.query(
      `UPDATE transactions SET name=$1, date=$2, price=$3, quantity=$4, amount=$5, category=$6, comment=$7
       WHERE id=$8 RETURNING *`,
      [name, date, price, quantity, amount, category, comment, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get categories list with stats
app.get('/api/categories', async (req, res) => {
  try {
    const { from, to, category } = req.query
    const conditions = []
    const params = []
    let i = 1
    if (from) { conditions.push(`date >= $${i++}`); params.push(from) }
    if (to) { conditions.push(`date <= $${i++}`); params.push(to) }
    if (category) { conditions.push(`category = $${i++}`); params.push(category) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(
      `SELECT category, COUNT(*) as count, SUM(amount) as total
       FROM transactions ${where} GROUP BY category ORDER BY total DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get summary by month
app.get('/api/summary', async (req, res) => {
  try {
    const { from, to, category } = req.query
    const conditions = []
    const params = []
    let i = 1
    if (from) { conditions.push(`date >= $${i++}`); params.push(from) }
    if (to) { conditions.push(`date <= $${i++}`); params.push(to) }
    if (category) { conditions.push(`category = $${i++}`); params.push(category) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month, category, COUNT(*) as count, SUM(amount) as total
       FROM transactions ${where} GROUP BY month, category ORDER BY month DESC, total DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Suggest category based on product name
app.get('/api/suggest-category', async (req, res) => {
  try {
    const { name } = req.query
    if (!name) return res.json({ category: '' })

    // Split name into words and search for any match
    const words = String(name).trim().split(/\s+/).filter((w) => w.length >= 3)
    if (!words.length) return res.json({ category: '' })

    const conditions = words.map((_, i) => `name ILIKE $${i + 1}`)
    const params = words.map((w) => `%${w}%`)

    const { rows } = await pool.query(
      `SELECT category, COUNT(*) as cnt
       FROM transactions
       WHERE (${conditions.join(' OR ')}) AND category != ''
       GROUP BY category
       ORDER BY cnt DESC
       LIMIT 1`,
      params
    )

    res.json({ category: rows.length ? rows[0].category : '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Finance API running on port ${PORT}`)
})
