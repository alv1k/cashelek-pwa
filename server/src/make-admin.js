import pool from './db.js'

const email = process.argv[2]

if (!email) {
  console.error('Usage: node make-admin.js <email>')
  process.exit(1)
}

async function makeAdmin() {
  try {
    const { rowCount } = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1",
      [email]
    )
    if (rowCount === 0) {
      console.error(`User with email "${email}" not found.`)
    } else {
      console.log(`User "${email}" is now an admin.`)
    }
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await pool.end()
  }
}

makeAdmin()
