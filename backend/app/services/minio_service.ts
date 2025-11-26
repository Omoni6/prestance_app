import { Client } from 'minio'
import { randomBytes } from 'node:crypto'

function env(key: string, fallback?: string) {
  const v = process.env[key]
  return typeof v === 'string' && v.length ? v : (fallback ?? '')
}

export default class MinioService {
  private client: Client
  private bucket: string

  constructor() {
    this.client = new Client({
      endPoint: env('MINIO_ENDPOINT', '127.0.0.1'),
      port: Number(env('MINIO_PORT', '9000')),
      useSSL: env('MINIO_USE_SSL', 'false') === 'true',
      accessKey: env('MINIO_ACCESS_KEY', ''),
      secretKey: env('MINIO_SECRET_KEY', ''),
    })
    this.bucket = env('MINIO_BUCKET', 'omoni-bucket')
  }

  async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) await this.client.makeBucket(this.bucket, '')
    } catch {}
  }

  async uploadFile(buffer: Buffer, path: string, filename?: string) {
    await this.ensureBucket()
    const name = filename || `${randomBytes(16).toString('hex')}`
    const key = `${path.replace(/\/*$/, '')}/${name}`
    await this.client.putObject(this.bucket, key, buffer)

    const proto = env('MINIO_USE_SSL', 'false') === 'true' ? 'https' : 'http'
    const url = `${proto}://${env('MINIO_ENDPOINT', '127.0.0.1')}:${env('MINIO_PORT', '9000')}/${this.bucket}/${key}`
    return { key, url }
  }
}
