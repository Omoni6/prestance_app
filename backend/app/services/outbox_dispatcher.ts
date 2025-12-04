export default class OutboxDispatcher {
  async dispatchPending() {
    const db = (await import('@adonisjs/lucid/services/db')).default
    const rows: any[] = await db.from('outbox').where('status', 'pending').select('id','type','target','payload_json').limit(10)
    let dispatched = 0
    for (const r of rows) {
      try {
        const payload = JSON.parse(String(r.payload_json||'{}'))
        if (r.type === 'deliver.send') {
          const channels: string[] = Array.isArray(payload.channels) ? payload.channels : []
          // Slack
          if (channels.includes('slack')) {
            try {
              const token = process.env.SLACK_BOT_TOKEN
              const text = `Livrable: ${payload.delivery_id || ''}`
              const resp = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: '#general', text }) })
              await resp.json()
            } catch {}
          }
          // Telegram
          if (channels.includes('telegram')) {
            try {
              const token = process.env.TELEGRAM_BOT_TOKEN_OMONI || process.env.TELEGRAM_BOT_TOKEN_OMANAGER
              const chatId = process.env.TELEGRAM_CHAT_ID || ''
              const text = `Livrable: ${payload.delivery_id || ''}`
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) })
            } catch {}
          }
          // Email
          if (channels.includes('email')) {
            try {
              const dbUser = await db.from('users').where('id', Number(payload.user_id||0)).select('email').first()
              const to = String(dbUser?.email || '')
              if (to) {
                const text = `Un livrable est prêt (ID ${payload.delivery_id||''}).` + (payload.url ? `\n${payload.url}` : '')
                const row: any = await db.from('project_deliveries').where('id', Number(payload.delivery_id||0)).select('storage_key','title','type').first()
                const { default: MailService } = await import('#services/mail_service')
                const ms = new MailService()
                const attachments: Array<{ filename: string; mime: string; content: Buffer }> = []
                const storageKey = String(row?.storage_key || '')
                if (storageKey) {
                  try {
                    const { default: MinioService } = await import('#services/minio_service')
                    const svc = new MinioService()
                    const buf = await svc.downloadFile(storageKey)
                    if (buf) {
                      const fname = storageKey.split('/').pop() || 'livrable'
                      const ext = (fname.split('.').pop() || '').toLowerCase()
                      const mimeMap: Record<string,string> = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webm:'audio/webm', mp4:'video/mp4', pdf:'application/pdf', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt:'text/plain' }
                      const mime = mimeMap[ext] || 'application/octet-stream'
                      attachments.push({ filename: fname, mime, content: buf })
                    }
                  } catch {}
                }
                if (attachments.length) await ms.sendWithAttachments(to, String(row?.title || 'Votre livrable'), text, attachments)
                else await ms.send(to, String(row?.title || 'Votre livrable'), text)
              }
            } catch {}
          }
          await db.from('project_deliveries').where('id', Number(payload.delivery_id||0)).update({ status: 'sent', sent_at: new Date(), updated_at: new Date() })
          await db.from('outbox').where('id', r.id).update({ status: 'sent', attempts: 1, updated_at: new Date() })
          dispatched++
        } else if (r.type === 'media.generate') {
          await db.from('outbox').where('id', r.id).update({ status: 'queued', attempts: 1, updated_at: new Date() })
          dispatched++
        } else if (r.type === 'newsletter.send') {
          try {
            const campaignId = Number(JSON.parse(String(r.payload_json||'{}')).campaign_id || 0)
            const camp: any = await db.from('newsletter_campaigns').where('id', campaignId).select('title','body_text').first()
            const subs: any[] = await db.from('newsletter_subscribers').select('email')
            const { default: MailService } = await import('#services/mail_service')
            const ms = new MailService()
            for (const s of subs) { try { await ms.send(String(s.email), String(camp?.title || 'Newsletter'), String(camp?.body_text || '')) } catch {} }
            await db.from('newsletter_campaigns').where('id', campaignId).update({ status: 'sent', updated_at: new Date() })
          } catch {}
          await db.from('outbox').where('id', r.id).update({ status: 'sent', attempts: 1, updated_at: new Date() })
          dispatched++
        } else {
          await db.from('outbox').where('id', r.id).update({ status: 'queued', attempts: 1, updated_at: new Date() })
          dispatched++
        }
      } catch {
        await db.from('outbox').where('id', r.id).update({ status: 'failed', attempts: (r.attempts||0)+1, updated_at: new Date() })
      }
    }
    return { success: true, dispatched }
  }
}
