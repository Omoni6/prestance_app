## Objectif
Aligner Frontend (Next.js), Backend (Adonis), Dashboard et Landing sur les domaines prod réels, préfixer toutes les routes backend en `/api`, supprimer les fallbacks et garantir l’usage unique de `DATABASE_URL` (VPS).

## Mises à jour Frontend (Next.js)
1. Environnements
- `frontend/.env` (DEV):
  - `NEXT_PUBLIC_FRONTEND_URL=http://localhost:3003`
  - `NEXT_PUBLIC_BACKEND_URL=http://localhost:3333/api`
  - `NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3003/dashboard`
  - `NEXT_PUBLIC_DONNA_URL=https://donna.omoniprestanceholding.com`
  - `NEXT_PUBLIC_N8N_URL=https://n8n.omoniprestanceholding.com`
- `frontend/.env.production` (PROD):
  - `NEXT_PUBLIC_FRONTEND_URL=https://omoniprestanceholding.com`
  - `NEXT_PUBLIC_BACKEND_URL=https://omoniprestanceholding.com/api`
  - `NEXT_PUBLIC_DASHBOARD_URL=https://omoniprestanceholding.com/dashboard`
  - `NEXT_PUBLIC_DONNA_URL=https://donna.omoniprestanceholding.com`
  - `NEXT_PUBLIC_N8N_URL=https://n8n.omoniprestanceholding.com`

2. Base URL unique côté code
- Solder les références directes aux URLs dans le code et centraliser l’accès via `NEXT_PUBLIC_*`:
  - `frontend/src/contexts/AuthContext.tsx`: utiliser `NEXT_PUBLIC_BACKEND_URL` pour `getApiUrl()`
  - Helpers `apiGet/apiPost`: s’assurer qu’ils concatènent sur `NEXT_PUBLIC_BACKEND_URL`
  - Supprimer tout fallback dur `localhost` hors DEV

3. Dashboard et pages
- Mettre à jour les appels existants (`/api/v1/...`) → `/api/...`
- Vérifier `ModuleGridClient`, `SectionModulesGrid`, modaux OAuth, webhooks Stripe, et références Google Callback; utiliser `NEXT_PUBLIC_BACKEND_URL`.

## Mises à jour Backend (Adonis)
1. Environnements
- `backend/.env` (DEV):
  - `NODE_ENV=development`, `PORT=3333`, `HOST=0.0.0.0`
  - `FRONTEND_URL=http://localhost:3003`
  - `BACKEND_URL=http://localhost:3333/api`
  - `DATABASE_URL=postgres://donna:donna@92.113.29.38:5432/donna_db`
- `backend/.env.production` (PROD):
  - `NODE_ENV=production`, `PORT=3333`, `HOST=0.0.0.0`
  - `FRONTEND_URL=https://omoniprestanceholding.com`
  - `BACKEND_URL=https://omoniprestanceholding.com/api`
  - `DATABASE_URL=postgres://donna:donna@92.113.29.38:5432/donna_db`

2. Préfix `/api`
- `backend/start/routes.ts`: grouper toutes les routes et les préfixer en `/api`:
```ts
Route.group(() => {
  // routes existantes
}).prefix('/api')
```
- Si le code utilise `/api/v1`, ajouter temporairement un alias (optionnel) pour compatibilité, puis migrer les appels vers `/api`.

3. Strict `DATABASE_URL`
- Vérifier `backend/config/database.ts`: connexion via `DATABASE_URL` sans fallback `PG_*`.
- Vérifier services et scripts DB: utiliser `process.env.DATABASE_URL` uniquement.

4. OAuth et webhooks
- Google OAuth redirect en PROD: `https://omoniprestanceholding.com/auth/callback/google`
- Stripe Checkout & Webhooks: URLs sur `https://omoniprestanceholding.com/...`
- Mettre à jour `FRONTEND_URL`/`BACKEND_URL` pour la fabrication des redirects côté contrôleurs.

## Traefik (Routing)
- `omoniprestanceholding.com` → container frontend (Next.js)
- `omoniprestanceholding.com/api` → container adonis-backend
- `donna.omoniprestanceholding.com` → container donna-webui
- `n8n.omoniprestanceholding.com` → container n8n

## Règles DEV
- Front local: `http://localhost:3003`
- Backend local: `http://localhost:3333/api`
- DB: VPS via `DATABASE_URL` (pas de base locale)

## Nettoyage et cohérence
- Supprimer toutes les références `localhost` hors DEV (frontend + backend)
- Remplacer `/api/v1` par `/api` dans les composants qui appellent le backend
- Vérifier les helpers et pages:
  - `frontend/src/lib/env-config.ts`
  - `frontend/src/contexts/AuthContext.tsx`
  - `frontend/src/lib/api.ts`
  - Composants / pages du dashboard faisant des fetch

## Vérifications finales
1. Lancer Front/Back en DEV et tester:
- Auth (login + Google callback)
- Modules et connecteurs (fetch sur `/api`)
- Checkout Stripe (URL prod en build prod; en dev, sandbox si disponible)
2. En PROD (après déploiement):
- Vérifier routage Traefik
- Vérifier que toutes les pages consomment `https://omoniprestanceholding.com/api`
- Vérifier webhooks Stripe/Google OAuth

## Livrables
- Fichiers `.env` DEV/PROD mis à jour (front/back)
- `start/routes.ts` préfixé `/api`
- Helpers et contextes front reliés à `NEXT_PUBLIC_BACKEND_URL`
- Rapport de recherche des anciennes URLs et remplacements
