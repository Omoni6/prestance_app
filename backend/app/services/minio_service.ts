import { Client } from 'minio'
import { randomBytes } from 'node:crypto'

function req(key: string) {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env ${key}`)
  return v
}

export default class MinioService {
  private client: Client
  private bucket: string

  constructor() {
    const endPoint = req('MINIO_ENDPOINT')
    const port = Number(req('MINIO_PORT'))
    const useSSL = req('MINIO_USE_SSL') === 'true'
    const accessKey = req('MINIO_ACCESS_KEY')
    const secretKey = req('MINIO_SECRET_KEY')
    this.client = new Client({ endPoint, port, useSSL, accessKey, secretKey })
    this.bucket = req('MINIO_BUCKET')
  }

  async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) await this.client.makeBucket(this.bucket, '')
  }

  async uploadFile(buffer: Buffer, path: string, filename?: string) {
    await this.ensureBucket()
    const name = filename || `${randomBytes(16).toString('hex')}`
    const key = `${path.replace(/\/*$/, '')}/${name}`
    await this.client.putObject(this.bucket, key, buffer)

    const proto = req('MINIO_USE_SSL') === 'true' ? 'https' : 'http'
    const url = `${proto}://${req('MINIO_ENDPOINT')}:${req('MINIO_PORT')}/${this.bucket}/${key}`
    return { key, url }
  }

  async removeFile(key: string) {
    await this.client.removeObject(this.bucket, key)
    return { success: true }
  }

  async downloadFile(key: string) {
    const stream = await this.client.getObject(this.bucket, key)
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (d: Buffer) => chunks.push(d))
      stream.on('end', () => resolve())
      stream.on('error', (e: any) => reject(e))
    })
    return Buffer.concat(chunks)
  }
}
