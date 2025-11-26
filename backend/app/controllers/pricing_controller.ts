import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class PricingController {
  public async listModules({ response }: HttpContext) {
    const rows = await db.from('pricing').where('type', 'module').select('*').catch(() => [])
    return response.ok({ pricing: rows })
  }
  public async listConnectors({ response }: HttpContext) {
    const rows = await db.from('pricing').where('type', 'connector').select('*').catch(() => [])
    return response.ok({ pricing: rows })
  }
}

