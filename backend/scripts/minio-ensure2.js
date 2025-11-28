import { Client } from 'minio'

function env(key, fallback) {
  const v = process.env[key]
  return typeof v === 'string' && v.length ? v : (fallback ?? '')
}

async function main() {
  const client = new Client({
    endPoint: env('MINIO_ENDPOINT', '127.0.0.1'),
    port: Number(env('MINIO_PORT', '9000')),
    useSSL: env('MINIO_USE_SSL', 'false') === 'true',
    accessKey: env('MINIO_ACCESS_KEY', ''),
    secretKey: env('MINIO_SECRET_KEY', ''),
  })
  const bucket = env('MINIO_BUCKET', 'omoni-bucket')
  try {
    const exists = await client.bucketExists(bucket)
    if (!exists) await client.makeBucket(bucket, '')
    const res = await client.putObject(bucket, 'health/minio.txt', Buffer.from('check'))
    console.log('minio ok:', !!res)
  } catch (e) {
    console.log('minio error:', e.message)
    process.exit(1)
  }
}

main()

