import MinioService from '../app/services/minio_service.js'

async function main() {
  const svc = new MinioService()
  await svc.ensureBucket()
  const res = await svc.uploadFile(Buffer.from('check'), 'health', 'minio.txt')
  console.log('minio upload:', res)
}

main().catch((e) => {
  console.log('error:', e.message)
  process.exit(1)
})

