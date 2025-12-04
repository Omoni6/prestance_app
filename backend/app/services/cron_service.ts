import db from '@adonisjs/lucid/services/db'
import { google } from 'googleapis'
import MailService from '#services/mail_service'

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

    // User task progress emails every 15 minutes
    this.intervals.push(setInterval(async () => {
      try {
        const users: any[] = await db.from('users').select('id','email','full_name').where('notifications_enabled', true)
        if (!users?.length) return
        const mail = new MailService()
        const sinceMs = 24 * 60 * 60 * 1000
        for (const u of users) {
          const uid = Number(u.id)
          const email = String(u.email || '')
          if (!email) continue
          const since = new Date(Date.now() - sinceMs)
          const rows: any[] = await db.from('tasks').where('user_id', uid).select('id','title','status','created_at','updated_at').orderBy('updated_at','desc').limit(50)
          const recent = rows.filter((r)=> {
            const ts = new Date(r.updated_at || r.created_at)
            const done = String(r.status||'').toLowerCase() === 'done'
            return ts > since && !done
          })
          if (!recent.length) continue
          const lines = recent.slice(0, 10).map((r)=> `• #${r.id} ${r.title} — ${String(r.status||'').toUpperCase()}`)
          const text = [
            `Bonjour ${String(u.full_name || '').trim() || '👋'},`,
            `Voici l’avancement de vos tâches (dernières 24h):`,
            '',
            ...lines,
            '',
            `— Donna`
          ].join('\n')
          await mail.send(email, 'Donna — Avancement de vos tâches', text)
        }
      } catch {}
    }, 900_000))

    // Daily Slack report at 07:30 local time
    this.intervals.push(setInterval(async () => {
      try {
        const now = new Date()
        const hh = now.getHours()
        const mm = now.getMinutes()
        const key = now.toDateString()
        ;(global as any).__daily_report_sent = (global as any).__daily_report_sent || {}
        const sentMap = (global as any).__daily_report_sent as Record<string, boolean>
        if (hh === 7 && mm >= 30 && mm < 32 && !sentMap[key]) {
          const since = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
          const until = now
          const logs: any[] = await db.rawQuery('SELECT action_name, COUNT(*) AS cnt FROM activity_logs WHERE created_at BETWEEN $1 AND $2 GROUP BY action_name ORDER BY cnt DESC', [since, until]).then((r:any)=> r.rows || [])
          const tasks: any[] = await db.rawQuery('SELECT id, title, status FROM tasks WHERE updated_at BETWEEN $1 AND $2 ORDER BY updated_at DESC LIMIT 20', [since, until]).then((r:any)=> r.rows || [])
          const deliveries: any[] = await db.rawQuery('SELECT id, type, title FROM project_deliveries WHERE created_at BETWEEN $1 AND $2 ORDER BY created_at DESC LIMIT 20', [since, until]).then((r:any)=> r.rows || [])
          const lines: string[] = []
          lines.push('Rapport du jour — Donna')
          lines.push('Actions exécutées:')
          if (logs.length) { for (const l of logs) lines.push(`• ${l.action_name}: ${l.cnt}`) } else { lines.push('• Aucune') }
          lines.push('Tâches modifiées:')
          if (tasks.length) { for (const t of tasks.slice(0,10)) lines.push(`• #${t.id} ${t.title} — ${String(t.status||'').toUpperCase()}`) } else { lines.push('• Aucune') }
          lines.push('Livrables créés:')
          if (deliveries.length) { for (const d of deliveries.slice(0,10)) lines.push(`• #${d.id} ${d.type} — ${d.title}`) } else { lines.push('• Aucun') }
          await postSlack(lines.join('\n'))
          sentMap[key] = true
        }
      } catch {}
    }, 60_000))

    // Gmail unread listener every 5 minutes
    this.intervals.push(setInterval(async () => {
      try {
        const creds: any[] = await db
          .from('user_connector_credentials')
          .where({ connector_code: 'gmail' })
          .select('user_id','access_token','refresh_token','expires_at','extra_json')
          .limit(200)
        if (!creds?.length) return
        for (const c of creds) {
          const userId = Number(c.user_id)
          const accessToken = String(c.access_token || '')
          const refreshToken = String(c.refresh_token || '')
          if (!accessToken && !refreshToken) continue
          const oauth2Client = new google.auth.OAuth2()
          const set: any = { access_token: accessToken }
          if (refreshToken) set.refresh_token = refreshToken
          oauth2Client.setCredentials(set)
          const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
          // Unread messages in INBOX newer than 5 minutes
          const q = 'label:INBOX is:unread newer_than:5m'
          const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 10 })
          const ids = (list.data.messages || []).map((m)=> m.id).filter(Boolean) as string[]
          if (!ids.length) {
            // Update cursor last_check to avoid noise
            try {
              const extra = { ...(c.extra_json || {}), gmail_last_check: new Date().toISOString() }
              await db.raw('UPDATE user_connector_credentials SET extra_json = ?, updated_at = NOW() WHERE user_id = ? AND connector_code = ?',[JSON.stringify(extra), userId, 'gmail'])
            } catch {}
            continue
          }
          const lines: string[] = []
          for (const id of ids) {
            try {
              const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['Subject','From','Date'] })
              const headers = (msg.data.payload?.headers || []) as Array<{ name: string; value: string }>
              const h = (n: string) => headers.find((x)=> x.name.toLowerCase() === n.toLowerCase())?.value || ''
              lines.push(`• ${h('Subject')} — ${h('From')}`)
            } catch {}
          }
          if (lines.length) {
            await postSlack(`📥 Gmail (user #${userId}) — nouveaux non lus:\n${lines.join('\n')}`)
          }
          try {
            const extra = { ...(c.extra_json || {}), gmail_last_check: new Date().toISOString(), gmail_last_count: ids.length }
            await db.raw('UPDATE user_connector_credentials SET extra_json = ?, updated_at = NOW() WHERE user_id = ? AND connector_code = ?',[JSON.stringify(extra), userId, 'gmail'])
          } catch {}
        }
      } catch {}
    }, 300_000))

    // Monthly finance summary on the 1st at 08:00
    this.intervals.push(setInterval(async () => {
      try {
        const now = new Date()
        const isFirst = now.getDate() === 1
        const hh = now.getHours()
        const mm = now.getMinutes()
        const key = `${now.getFullYear()}-${now.getMonth()+1}-finance`
        ;(global as any).__monthly_finance_sent = (global as any).__monthly_finance_sent || {}
        const sentMap = (global as any).__monthly_finance_sent as Record<string, boolean>
        if (isFirst && hh === 8 && mm < 5 && !sentMap[key]) {
          const prev = new Date(now.getFullYear(), now.getMonth(), 1)
          const start = new Date(prev.getFullYear(), prev.getMonth(), 1)
          const end = new Date(prev.getFullYear(), prev.getMonth()+1, 0)
          const s = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-01`
          const e = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`
          const rev = await db.rawQuery("SELECT COALESCE(SUM(amount),0) AS s FROM finance_entries WHERE type='revenue' AND date BETWEEN $1 AND $2", [s, e]).then((r:any)=> Number(r.rows?.[0]?.s || 0))
          const exp = await db.rawQuery("SELECT COALESCE(SUM(amount),0) AS s FROM finance_entries WHERE type='expense' AND date BETWEEN $1 AND $2", [s, e]).then((r:any)=> Number(r.rows?.[0]?.s || 0))
          const text = [
            `Rapport financier du mois précédent (${start.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })})`,
            `Revenus: ${rev.toFixed(2)}`,
            `Dépenses: ${exp.toFixed(2)}`,
            `Résultat: ${(rev-exp).toFixed(2)}`,
          ].join('\n')
          await postSlack(text)
          sentMap[key] = true
        }
      } catch {}
    }, 60_000))
  }
}
