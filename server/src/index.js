import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from './db.js'

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_for_dev'

app.use(cors())
app.use(express.json())

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) return res.status(401).json({ error: 'Access denied' })

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' })
    req.user = user
    next()
  })
}

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = crypto.randomUUID()

    const { rows } = await pool.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
      [userId, email, hashedPassword, name]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' })
    }
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.user.id])
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { category, exclude_category, from, to, search, limit = 100, offset = 0 } = req.query
    const conditions = ['user_id = $1']
    const params = [req.user.id]
    let i = 2

    if (category) {
      conditions.push(`category = $${i++}`)
      params.push(category)
    }
    if (exclude_category) {
      conditions.push(`category != $${i++}`)
      params.push(exclude_category)
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

    const where = `WHERE ${conditions.join(' AND ')}`
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
app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { id, name, date, price, quantity, amount, category, comment } = req.body
    const { rows } = await pool.query(
      `INSERT INTO transactions (id, user_id, name, date, price, quantity, amount, category, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id || crypto.randomUUID(), req.user.id, name, date, price, quantity, amount, category, comment || '']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update transaction
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { name, date, price, quantity, amount, category, comment } = req.body
    const { rows } = await pool.query(
      `UPDATE transactions SET name=$1, date=$2, price=$3, quantity=$4, amount=$5, category=$6, comment=$7
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [name, date, price, quantity, amount, category, comment, req.params.id, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete transaction
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!rowCount) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get categories list with stats
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { from, to, category } = req.query
    const conditions = ['user_id = $1']
    const params = [req.user.id]
    let i = 2
    if (from) { conditions.push(`date >= $${i++}`); params.push(from) }
    if (to) { conditions.push(`date <= $${i++}`); params.push(to) }
    if (category) { conditions.push(`category = $${i++}`); params.push(category) }
    const where = `WHERE ${conditions.join(' AND ')}`
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
app.get('/api/summary', authenticateToken, async (req, res) => {
  try {
    const { from, to, category } = req.query
    const conditions = ['user_id = $1']
    const params = [req.user.id]
    let i = 2
    if (from) { conditions.push(`date >= $${i++}`); params.push(from) }
    if (to) { conditions.push(`date <= $${i++}`); params.push(to) }
    if (category) { conditions.push(`category = $${i++}`); params.push(category) }
    const where = `WHERE ${conditions.join(' AND ')}`
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

// Parse receipt text into items
app.post('/api/parse-receipt', (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.json({ items: [] })

    const lines = text.split('\n').filter((l) => l.trim())
    const items = []
    
    for (const line of lines) {
      // Common receipt patterns: 
      // "Product Name 123.45"
      // "Product Name 123.45 * 1.000"
      // "123.45 * 1.000 = 123.45"
      
      const priceMatch = line.match(/(.+?)\s+([\d.,]+)\s*[₽р]?\s*$/)
      if (priceMatch) {
        const name = priceMatch[1].trim()
        const price = parseFloat(priceMatch[2].replace(',', '.'))
        if (!isNaN(price)) {
          items.push({ name, price, quantity: 1 })
        }
      }
    }
    
    res.json({ items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// One-time migration: re-categorize income transactions based on name
const INCOME_RULES = [
  { match: /^такси$/i, category: 'такси' },
  { match: /^(зп |за )?Айсен/i, category: 'зп Айсен' },
  { match: /^зп Алена/i, category: 'зп Алена' },
  { match: /^аванс НВК/i, category: 'аванс НВК Саха' },
  { match: /^(нвк саха|НВК Саха|зп НВК)/i, category: 'зп НВК Саха' },
  { match: /^(больничный|Помощь от родственников)/i, category: 'зп Айсен' },
]

app.post('/api/migrate-income-categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, category FROM transactions WHERE category = 'доход'"
    )
    let updated = 0
    const changes = []
    for (const row of rows) {
      const rule = INCOME_RULES.find((r) => r.match.test(row.name.trim()))
      if (rule) {
        await pool.query('UPDATE transactions SET category = $1 WHERE id = $2', [rule.category, row.id])
        updated++
        changes.push({ name: row.name, category: rule.category })
      }
    }
    res.json({ updated, total: rows.length, changes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Finance API running on port ${PORT}`)
})
