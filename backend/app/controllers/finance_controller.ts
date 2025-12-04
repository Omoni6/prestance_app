import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class FinanceController {
  public async summary({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const uid = Number(user.id)

      const budgets = await db.rawQuery("SELECT COALESCE(SUM(budget_total),0) AS total, MIN(budget_currency) AS currency FROM projects WHERE user_id = ?", [uid])
      const budgetTotal = Number(budgets?.rows?.[0]?.total || 0)
      const budgetCurrency = String(budgets?.rows?.[0]?.currency || 'EUR')

      const rev: any = await db.rawQuery("SELECT COALESCE(SUM(amount),0) AS s FROM finance_entries WHERE user_id = ? AND type = 'revenue'", [uid])
      const exp: any = await db.rawQuery("SELECT COALESCE(SUM(amount),0) AS s FROM finance_entries WHERE user_id = ? AND type = 'expense'", [uid])
      const invoices: any = await db.rawQuery("SELECT COUNT(*) AS c FROM finance_entries WHERE user_id = ? AND type = 'invoice'", [uid])

      const revenue = Number(rev?.rows?.[0]?.s || 0)
      const expenses = Number(exp?.rows?.[0]?.s || 0)
      const pnl = revenue - expenses

      return response.ok({
        budget: { total: budgetTotal, currency: budgetCurrency, remaining: Math.max(budgetTotal - expenses, 0) },
        totals: { revenue, expenses, pnl },
        invoices: { count: Number(invoices?.rows?.[0]?.c || 0) },
      })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async journalToday({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const uid = Number(user.id)
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const rows: any = await db.rawQuery("SELECT id, type, amount, currency, date, title, source FROM finance_entries WHERE user_id = ? AND date = ? ORDER BY id DESC", [uid, dateStr])
      return response.ok({ date: dateStr, entries: rows?.rows || [] })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async pnlMonth({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const uid = Number(user.id)
      const month = String(request.input('month') || '') // format YYYY-MM
      let yyyy = 0, mm = 0
      if (/^\d{4}-\d{2}$/.test(month)) {
        yyyy = Number(month.slice(0, 4))
        mm = Number(month.slice(5, 7))
      } else {
        const d = new Date()
        yyyy = d.getFullYear()
        mm = d.getMonth() + 1
      }
      const start = `${yyyy}-${String(mm).padStart(2, '0')}-01`
      const endDate = new Date(yyyy, mm, 0)
      const end = `${yyyy}-${String(mm).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

      const rev: any = await db.rawQuery("SELECT COALESCE(SUM(amount),0) AS s FROM finance_entries WHERE user_id = ? AND type = 'revenue' AND date BETWEEN ? AND ?", [uid, start, end])
      const exp: any = await db.rawQuery("SELECT COALESCE(SUM(amount),0) AS s FROM finance_entries WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?", [uid, start, end])
      const revenue = Number(rev?.rows?.[0]?.s || 0)
      const expenses = Number(exp?.rows?.[0]?.s || 0)
      return response.ok({ month: `${yyyy}-${String(mm).padStart(2, '0')}`, revenue, expenses, pnl: revenue - expenses })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async createEntry({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const uid = Number(user.id)
      const payload = {
        project_id: request.input('project_id') ? Number(request.input('project_id')) : null,
        source: String(request.input('source') || 'manual'),
        type: String(request.input('type') || 'invoice'),
        amount: Number(request.input('amount') || 0),
        currency: String(request.input('currency') || 'EUR'),
        date: String(request.input('date') || new Date().toISOString().slice(0, 10)),
        title: String(request.input('title') || ''),
        external_id: String(request.input('external_id') || ''),
        file_key: String(request.input('file_key') || ''),
        metadata: request.input('metadata') || null,
      }
      const inserted: any = await db.table('finance_entries').insert({ ...payload, user_id: uid, created_at: new Date() }).returning('id')
      const id = Number(inserted?.[0]?.id || 0)
      return response.ok({ success: true, id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

