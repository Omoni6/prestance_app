import db from '@adonisjs/lucid/services/db'

export async function ensureUsersTableColumns() {
  try {
    const res = await db.raw(
      `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
      ['public', 'users']
    )
    const cols = new Set<string>((res.rows || []).map((r: any) => r.column_name))
    if (!cols.has('full_name')) {
      await db.raw(`ALTER TABLE users ADD COLUMN full_name varchar(255) NULL`)
    }
  } catch {}
}
