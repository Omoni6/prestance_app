import db from '@adonisjs/lucid/services/db'

export async function ensureAbilitiesColumnIsText() {
  try {
    const res = await db.raw(
      `SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3`,
      ['public', 'auth_access_tokens', 'abilities']
    )
    const dataType = res.rows?.[0]?.data_type
    if (dataType && dataType !== 'text') {
      await db.raw(`ALTER TABLE auth_access_tokens ALTER COLUMN abilities TYPE text USING abilities::text`)
    }
  } catch {}
}
