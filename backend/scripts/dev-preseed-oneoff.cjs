const { Client } = require('pg')

const conn = 'postgresql://donna:donna@92.113.29.38:5432/donna_db'
const email = process.argv[2] || 'bonlar.dalyla@gmail.com'
const DEFAULT_MODS = ['planifi', 'cree', 'publie', 'commercial']

;(async () => {
  const c = new Client({ connectionString: conn })
  await c.connect()
  const u = await c.query('SELECT id,email FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email])
  if (!u.rows[0]) {
    console.error('user_not_found')
    process.exit(1)
  }
  const uid = u.rows[0].id
  for (const key of DEFAULT_MODS) {
    await c.query(
      "INSERT INTO user_modules (user_id, module_key, is_active, activated_at) SELECT $1, $2, TRUE, NOW() WHERE NOT EXISTS (SELECT 1 FROM user_modules WHERE user_id=$1 AND LOWER(module_key)=LOWER($2))",
      [uid, key]
    )
  }
  const mc = await c.query("SELECT connector_code FROM module_connectors WHERE is_included = TRUE")
  const inc = new Set(mc.rows.map((r) => String(r.connector_code).toLowerCase()))
  for (const code of inc) {
    await c.query(
      "INSERT INTO user_connectors (user_id, connector_code, enabled, activated_at, price) SELECT $1, $2, TRUE, NOW(), 0 WHERE NOT EXISTS (SELECT 1 FROM user_connectors WHERE user_id=$1 AND LOWER(connector_code)=LOWER($2))",
      [uid, code]
    )
  }
  console.log('ok for', email)
  await c.end()
})().catch((e) => {
  console.error('error:', e.message)
  process.exit(1)
})
