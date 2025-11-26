import env from '#start/env'

console.log('Environment variables:')
console.log('PG_HOST:', env.get('PG_HOST'))
console.log('PG_PORT:', env.get('PG_PORT'))
console.log('PG_USER:', env.get('PG_USER'))
console.log('PG_PASSWORD:', env.get('PG_PASSWORD'))
console.log('PG_DB_NAME:', env.get('PG_DB_NAME'))
