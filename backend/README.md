## 🔄 DB Synchronisation (Local ↔ VPS)

- `npm run db:pull` → copie la base du VPS en local
- `npm run db:push` → pousse la base locale vers le VPS
- `npm run db:check` → vérifie les différences de schéma

### Prérequis
- `pg_dump` et `pg_restore` installés et accessibles dans le PATH
- Variables de connexion configurées dans `backend/.env` (local) et `backend/.env.production` (VPS)

### Utilisation
1. Vérifier la cohérence des schémas
   - `npm run db:check`
2. Cloner la DB VPS vers local
   - `npm run db:pull`
3. Pousser la DB locale vers le VPS
   - `npm run db:push`

### Logs
- ✔ Migration sync OK
- ⚠ Différences détectées
- ❌ Erreur connexion VPS
- ⏳ Dump en cours…
- 📥 Pull terminé
- 📤 Push terminé
