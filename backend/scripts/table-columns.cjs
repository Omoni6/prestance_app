const { Client } = require('pg')
const conn = 'postgresql://donna:donna@92.113.29.38:5432/donna_db'
const table = process.argv[2] || 'user_modules'
;(async () => {
  const c = new Client({ connectionString: conn })
  await c.connect()
  const r = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
    [table]
  )
  console.log(r.rows)
  await c.end()
})().catch((e) => { console.error('error:', e.message); process.exit(1) })

