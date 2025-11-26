import type { HttpContext } from '@adonisjs/core/http'
import MinioService from '#services/minio_service'
import { promises as fs } from 'node:fs'

export default class UploadsController {
  public async upload({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const file: any = request.file('file')
      if (!file) return response.badRequest({ error: 'no_file' })

      let buffer: Buffer | null = null
      try {
        if (typeof file.toBuffer === 'function') buffer = await file.toBuffer()
      } catch {}
      if (!buffer) {
        const tmp = (file as any).tmpPath
        if (!tmp) return response.badRequest({ error: 'invalid_upload' })
        buffer = await fs.readFile(tmp)
      }

      const svc = new MinioService()
      const isBranding = Boolean(request.input('branding'))
      const basePath = isBranding ? `clients/${user.id}/logos` : `clients/${user.id}/docs`
      const orig = String((file?.clientName || file?.fileName || 'upload.bin')).replace(/[^\w\.-]+/g, '_')
      const result = await svc.uploadFile(buffer, basePath, orig)
      return response.ok({ success: true, path: result.key, key: result.key, url: result.url })
    } catch (err) {
      return response.internalServerError({ error: 'upload_failed' })
    }
  }
}
