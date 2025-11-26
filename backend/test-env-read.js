// Test simple pour vérifier si le .env est lu
import { readFileSync } from 'fs'
import { join } from 'path'

try {
  const envPath = join(process.cwd(), '.env')
  const envContent = readFileSync(envPath, 'utf-8')
  console.log('=== Contenu du .env ===')
  console.log(envContent)

  console.log('\n=== Valeur de PG_HOST ===')
  const pgHostMatch = envContent.match(/^PG_HOST=(.+)$/m)
  if (pgHostMatch) {
    console.log('PG_HOST trouvé:', pgHostMatch[1])
  } else {
    console.log('PG_HOST non trouvé')
  }
} catch (error) {
  console.error('Erreur lecture .env:', error.message)
}
