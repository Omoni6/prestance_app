## Objectifs
- Vérifier toutes les routes API et garantir qu’elles lisent/écrivent dans la BDD VPS.
- Aligner le schéma et la logique data autour de `user_modules` et `user_connectors`.
- Nettoyer et unifier les fichiers `.env` (backend uniquement sur VPS; front → backend local).
- Préparer un playbook de tests rapides et reproductibles pour chaque endpoint.

## État Actuel Résumé
- Backend Adonis local relié à la BDD VPS (PG_HOST=92.113.29.38). 
- Front Next.js appelle `http://localhost:3333/api/v1/...`.
- Routes principales présentes: auth, modules, connectors, pricing, onboarding, analytics, projects, payments, notifications.
- Logique modules: lecture depuis `user_modules` + `modules` normalisée; corrections en cours appliquées.

## Audit et Corrections des Routes
1. Auth (`/api/v1/auth/*`)
   - Vérifier/forcer protection sur `me`, `logout`.
   - Tester login/signup et extraction token.
2. Modules (`/api/v1/modules/*`)
   - `GET /modules` (protégé): lister modules + statut actif depuis `user_modules`.
   - `GET /modules/user-modules?email=...`: jointure `user_modules`→`modules` (case-insensitive email).
   - `POST /modules/activate|deactivate` (protégé): opère via `ModuleService` avec `module_id`.
3. Connectors (`/api/v1/connectors/*`)
   - `GET /connectors` et `GET /connectors/premium` (publics).
   - `GET /modules/:key/connectors` (protégé): map modules→connecteurs inclus/premium.
   - OAuth: `GET /connectors/:key/redirect`, `GET /connectors/:key/callback`.
4. Pricing (`/api/v1/pricing/*`)
   - `GET /pricing/modules`, `GET /pricing/connectors` (publics).
5. Onboarding / Analytics / Projects / Payments / Notifications
   - Vérifier protection (guards) et réponses; s’assurer des lectures sur tables VPS.

## Alignement Schéma BDD VPS
- Valider tables clés présentes et colonnes:
  - `users`, `modules (id,name,description)`, `user_modules (user_id,module_id,is_active)`, `module_connectors (module_key,connector_code,included)`, `connectors (code,name,is_premium)`.
- Si divergence:
  - Adapter requêtes (éviter colonnes absentes: ex. `module_key` dans `user_modules`).
  - Normaliser `name` des modules via une fonction canonical.

## Unification Backend (user_modules / user_connectors)
- `ModuleService`:
  - Liste modules: join `user_modules`→`modules`, statut via `is_active`.
  - Activation: résoudre `module_id` par `LOWER(modules.name)`, insérer `user_modules(user_id,module_id,is_active=true)`, auto-activer connecteurs inclus.
  - Désactivation: supprimer `user_modules`, nettoyer connecteurs premium liés.
- `ModulesController`:
  - `activate/deactivate`: utiliser `auth` et `ModuleService` avec `user.id`.
  - `userModules`: join `user_modules`→`modules`, réponse normalisée (`planifi, cree, publie, commercial`).
- Supprimer tout fallback UI côté front qui « active » visuellement si l’API renvoie vide.

## .env Propres
- Backend (`backend/.env` uniquement):
  - `PG_HOST=92.113.29.38`
  - `PG_PORT=5432`
  - `PG_USER=donna`
  - `PG_PASSWORD=donna`
  - `PG_DB=donna_db`
  - `DATABASE_URL=postgresql://donna:donna@92.113.29.38:5432/donna_db`
- Backend `start/env.ts`: charger `.env` (ne pas injecter `.env.production*`).
- Front (`frontend/.env.local`):
  - `NEXT_PUBLIC_API_HOST=http://localhost:3333`
  - `NEXT_PUBLIC_API_URL=http://localhost:3333/api/v1`

## Playbook de Tests
- Auth:
  - Login: POST `/api/v1/auth/login` → récupérer `token`.
  - Me: GET `/api/v1/auth/me` avec `Authorization: Bearer <token>`.
  - Logout: POST `/api/v1/auth/logout` (Bearer).
- Modules:
  - Liste: GET `/api/v1/modules` (Bearer).
  - Par email: GET `/api/v1/modules/user-modules?email=<mail>`.
  - Activer: POST `/api/v1/modules/activate` body `{"module":"planifi"}` (Bearer).
  - Désactiver: POST `/api/v1/modules/deactivate` body `{"module":"planifi"}` (Bearer).
- Connectors:
  - GET `/api/v1/connectors`, GET `/api/v1/connectors/premium`.
  - GET `/api/v1/modules/planifi/connectors` (Bearer).
- Pricing:
  - GET `/api/v1/pricing/modules`, GET `/api/v1/pricing/connectors`.
- Commandes PowerShell (exemples):
  - `$login = Invoke-WebRequest -UseBasicParsing -Method POST -Uri "http://localhost:3333/api/v1/auth/login" -Body (@{ email="<email>"; password="<pw>" } | ConvertTo-Json) -ContentType "application/json" ; $token = ($login.Content | ConvertFrom-Json).token`
  - `Invoke-WebRequest -UseBasicParsing "http://localhost:3333/api/v1/modules" -Headers @{ Authorization = "Bearer $token" }`

## Sécurité & CORS
- CORS backend: autoriser `http://localhost:3003` et headers `Authorization`.
- Ne pas exposer secrets côté front; conserver secrets uniquement dans backend `.env`.

## Rollback & Sécurité Opérationnelle
- Toutes les modifs se limitent au backend local et fronts env; pas d’écriture sur VPS hors accès DB.
- Possibilité de revert: sauvegarde des fichiers avant modification.

## Livrables
- Backend unifié (services + contrôleurs) aligné sur schéma VPS.
- `.env` backend propre et chargé sans override.
- Playbook de tests reproductibles.
- Audit clôturé avec rapports rapides sur routes 200/401/404.

Souhaitez-vous que je procède immédiatement aux derniers nettoyages côté frontend (suppression des fallbacks visuels) et j’exécute le playbook de tests complet ?