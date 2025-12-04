import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class MeetingsController {
  public async listUser({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const rows: any = await db.raw(
        'SELECT mn.* FROM meeting_notes mn LEFT JOIN projects p ON mn.project_id = p.id WHERE (p.user_id = $1 OR mn.project_id IS NULL) ORDER BY mn.created_at DESC LIMIT 50',
        [Number(user.id)]
      )
      return response.ok({ notes: rows?.rows || [] })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
  public async start({ auth, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const projectId = Number(request.input('project_id') || 0) || null
      const source = String(request.input('source') || 'webrtc')
      const title = String(request.input('title') || '')
      const ins: any = await db.raw(
        'INSERT INTO meeting_notes (project_id, source, title, transcript, created_at) VALUES (?, ?, ?, ?, NOW()) RETURNING id',
        [projectId, source, title, '']
      )
      const id = Number(ins?.rows?.[0]?.id || 0)
      return response.ok({ note_id: id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async append({ auth, params, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const id = Number(params.id)
      const text = String(request.input('text') || '')
      const row: any = await db.from('meeting_notes').where('id', id).select('transcript').first()
      const current = String(row?.transcript || '')
      const next = current ? `${current}\n${text}` : text
      await db.from('meeting_notes').where('id', id).update({ transcript: next, updated_at: new Date() })
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async finish({ auth, params, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const id = Number(params.id)
      const channels = request.input('channels') || ['email']
      const actions: Array<string> = (request.input('actions') || [])
      const noteRow: any = await db.from('meeting_notes').where('id', id).select('project_id', 'title', 'transcript').first()
      const projectId = Number(noteRow?.project_id || 0) || null
      const transcript = String(noteRow?.transcript || '')

      // Generate summary and suggested actions via OpenAI
      let summary = ''
      let autoActions: string[] = []
      try {
        const apiKey = process.env.OPENAI_API_KEY
        const prompt = `Tu es l'assistant Donna. Résume la réunion en 5 points et extrait 5 actions concrètes (courte phrase). Transcript:\n\n${transcript}`
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
        })
        const data: any = await resp.json()
        summary = String(data?.choices?.[0]?.message?.content || '')
        // naive action extraction: split lines starting with '-' or digits
        autoActions = summary.split(/\r?\n/).filter((l) => /^[-\d]/.test(l)).map((l) => l.replace(/^[-\d\.\s]+/, '').trim()).slice(0, 5)
      } catch {}

      const allActions = actions && actions.length ? actions : autoActions
      // create tasks for actions
      for (const a of actions) {
        await db.raw('INSERT INTO tasks (user_id, project_id, title, status, created_at) VALUES (?, ?, ?, ?, NOW())', [Number(user.id), projectId, String(a), 'todo'])
      }
      for (const a of allActions) {
        await db.raw('INSERT INTO tasks (user_id, project_id, title, status, created_at) VALUES (?, ?, ?, ?, NOW())', [Number(user.id), projectId, String(a), 'todo'])
      }

      // Upload note file to MinIO (transcript + summary)
      let storageKey = ''
      let url = ''
      try {
        const { default: MinioService } = await import('#services/minio_service')
        const svc = new MinioService()
        const content = `# Notes de réunion\n\n## Titre\n${String(noteRow?.title || '')}\n\n## Résumé\n${summary}\n\n## Transcript\n${transcript}`
        const buffer = Buffer.from(content, 'utf-8')
        const basePath = `projects/${projectId || 'general'}/notes`
        const up = await svc.uploadFile(buffer, basePath, `meeting-${id}.md`)
        storageKey = up.key
        url = up.url
      } catch {}
      // queue delivery
      const ins: any = await db.raw('INSERT INTO project_deliveries (project_id, type, title, url, storage_key, channels, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING id', [projectId, 'document', String(noteRow?.title || 'Notes de réunion'), url, storageKey, JSON.stringify(channels), 'queued'])
      const deliveryId = Number(ins?.rows?.[0]?.id || 0)
      await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW())', ['deliver.send', 'document', JSON.stringify({ user_id: Number(user.id), project_id: projectId, delivery_id: deliveryId, channels }), 'pending'])
      return response.ok({ success: true, delivery_id: deliveryId })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async transcribe({ auth, params, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const id = Number(params.id)
      const file: any = request.file('audio')
      if (!file) return response.badRequest({ error: 'no_audio' })
      let buffer: Buffer | null = null
      try { if (typeof file.toBuffer === 'function') buffer = await file.toBuffer() } catch {}
      if (!buffer) { const tmp = (file as any).tmpPath; if (!tmp) return response.badRequest({ error: 'invalid_upload' }); buffer = await (await import('node:fs/promises')).readFile(tmp) }
      const apiKey = process.env.OPENAI_API_KEY
      const fd = new (await import('node-fetch')).FormData()
      // @ts-ignore
      fd.append('file', new (await import('node:buffer')).Blob([buffer], { type: file?.type || 'audio/webm' }), file?.clientName || 'chunk.webm')
      fd.append('model', 'whisper-1')
      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd as any })
      const data: any = await resp.json()
      const text = String(data?.text || '')
      const row: any = await db.from('meeting_notes').where('id', id).select('transcript').first()
      const current = String(row?.transcript || '')
      const next = current ? `${current}\n${text}` : text
      await db.from('meeting_notes').where('id', id).update({ transcript: next, updated_at: new Date() })
      return response.ok({ text })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async delete({ auth, params, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const id = Number(params.id)
      await db.from('meeting_notes').where('id', id).delete()
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
