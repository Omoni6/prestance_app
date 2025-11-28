import { Client } from 'pg'

const codes = [
  'omoni_calendar','telegram','slack','gmail','calendly','smtp','google_calendar',
  'omoni_bucket','nano_banana','sora2','suno','elevenlabs','notion','canva','google_drive',
  'blotato','ticketmaster','n8n','spotify',
  'omoni_crm','hubspot','salesforce','whatsapp_business','twilio','lemonsqueezy'
]

async function main() {
  const client = new Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined)
  await client.connect()
  for (const code of codes) {
    try {
      await client.query("INSERT INTO connectors(code, name, is_premium, created_at) VALUES($1,$1,false,NOW()) ON CONFLICT (code) DO NOTHING", [code])
    } catch {}
  }
  const res = await client.query('SELECT COUNT(*) AS c FROM connectors')
  console.log('connectors count:', Number(res.rows[0].c))
  await client.end()
}

main().catch((e) => {
  console.log('error:', e.message)
  process.exit(1)
})
