import db from '@adonisjs/lucid/services/db'

async function postSlack(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL || process.env.SLACK_OPS_WEBHOOK_URL || process.env.SLACK_FINANCE_WEBHOOK_URL
  if (!url) return false
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    return res.ok
  } catch {
    return false
  }
}

export default class CronService {
  private intervals: NodeJS.Timer[] = []

  public async start() {
    // Outbox dispatcher every 60s
    this.intervals.push(setInterval(async () => {
      try {
        const { default: OutboxDispatcher } = await import('#services/outbox_dispatcher')
        const d = new OutboxDispatcher()
        const res = await d.dispatchPending()
        if (res?.dispatched) {
          await postSlack(`Outbox: ${res.dispatched} éléments dispatchés`)
        }
      } catch {}
    }, 60_000))

    // New tasks alert every 2 minutes
    this.intervals.push(setInterval(async () => {
      try {
        const since = new Date(Date.now() - 5 * 60_000)
        const rows: any[] = await db.from('tasks').select('id','title','status','created_at').orderBy('created_at','desc').limit(20)
        const recent = rows.filter(r => new Date(r.created_at) > since && String(r.status||'').toLowerCase() !== 'done')
        if (recent.length) {
          const lines = recent.map((r)=> `• #${r.id} ${r.title}`).join('\n')
          await postSlack(`Nouvelles demandes (<=5 min)\n${lines}`)
        }
      } catch {}
    }, 120_000))

    // Calendar reminders every 5 minutes (optional generic)
    this.intervals.push(setInterval(async () => {
      try {
        // Example: trigger upcoming events notification
        const windowStart = new Date()
        const windowEnd = new Date(Date.now() + 60 * 60_000)
        const events: any[] = await db.rawQuery("SELECT id, title, start_at FROM calendar_events WHERE start_at BETWEEN $1 AND $2", [windowStart, windowEnd]).then((r:any)=> r.rows || [])
        if (events.length) {
          const text = `Événements à venir (<1h)\n` + events.map((e)=> `• ${e.title} à ${new Date(e.start_at).toLocaleString('fr-FR')}`).join('\n')
          await postSlack(text)
        }
      } catch {}
    }, 300_000))
  }
}
