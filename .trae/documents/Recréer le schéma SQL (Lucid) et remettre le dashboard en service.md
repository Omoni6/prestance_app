## Tables conservées et cibles d’injection
- Conservées: `users`, `modules`, `user_modules`, `pricing`, `webhooks_clients`, `webhooks_logs`
- À créer avant injection (via migrations): `auth_access_tokens`, `module_connectors`, `user_connectors`, `newsletter_subscribers` (optionnel), `analytics_events`/`analytics_stats` (si utilisées)

## Ce que je vais injecter et dans quelles tables
### 1) modules
- 4 lignes (si manquantes ou à actualiser):
  - PLANIFI — title: "Planifi", description: "Module de planification stratégique"
  - CREE — title: "Crée", description: "Création de contenu assistée par IA"
  - PUBLIE — title: "Publie", description: "Publication automatisée multi‑plateforme"
  - COMMERCIAL — title: "Commercial", description: "Module de gestion commerciale"
- Colonnes utilisées: `name` (UPPERCASE), `title`, `description`. (Si vous validez, j’ajoute `slug` pour utilisation côté API)

### 2) pricing
- Modules (si manquants):
  - `plan_name`: `planifi`/`cree`/`publie`/`commercial`
  - `display_name`: `PLANIFI`/`CREE`/`PUBLIE`/`COMMERCIAL`
  - `description`: texte court
  - `price_monthly`: 150.00
- Connecteurs (premium):
  - `plan_name`: code connecteur (ex. `gmail`, `google_calendar`, `salesforce`, `whatsapp_business`, `twilio`, `calendly`, `spotify`, `notion`, `n8n`, `lemonsqueezy`, `suno`, `ticketmaster`, `sora2`, `blotato`)
  - `display_name`: nom lisible (ex. "Gmail")
  - `description`: courte
  - `price_monthly`: valeurs initiales (ex. 9.00–19.00 selon connecteur, ajustables). Je propose: `gmail` 9, `google_calendar` 9, `calendly` 9, `notion` 9, `slack` 9, `hubspot` 12, `spotify` 9, `n8n` 12, `lemonsqueezy` 12, `twilio` 12, `whatsapp_business` 12, `salesforce` 19, `suno` 12, `ticketmaster` 12, `sora2` 12, `blotato` 9.

### 3) module_connectors
- Injection par module (included vs premium):
  - planifi:
    - included: `omoni_calendar`, `telegram`, `slack`
    - premium: `gmail`, `calendly`, `smtp`, `google_calendar`
  - cree:
    - included: `omoni_bucket`, `telegram`, `slack`, `nano_banana`, `sora2`
    - premium: `suno`, `elevenlabs`, `notion`, `canva`
  - publie:
    - included: `omoni_bucket`, `blotato`
    - premium: `ticketmaster`, `n8n`, `spotify`
  - commercial:
    - included: `omoni_crm`, `telegram`, `slack`, `omoni_calendar`, `hubspot`
    - premium: `salesforce`, `whatsapp_business`, `twilio`, `lemonsqueezy`
- Colonnes: `module_key` (ex. `planifi`), `connector_code`, `included` (bool), `type` (`'premium'` ou `NULL`)

### 4) user_modules / user_connectors
- `user_modules`: pas d’injection par défaut (restent dépendants des activations utilisateur). Option Dev: activer les 4 modules pour un compte de test via l’endpoint dev.
- `user_connectors`: pas d’injection par défaut (créés/activés au clic dans le dashboard)

### 5) newsletter_subscribers
- Pas de seed. Insertion au fil de l’eau via `/api/v1/newsletter`.

## Étapes d’exécution (après votre OK)
1. Créer les migrations pour tables manquantes (`auth_access_tokens`, `module_connectors`, `user_connectors`, éventuellement `newsletter_subscribers`).
2. Exécuter les migrations.
3. Injecter les données de base dans `modules`, `pricing`, `module_connectors`.
4. Vérifier les endpoints:
   - `GET /api/public/modules` (accueil)
   - `GET /api/v1/pricing/modules|connectors`
   - `GET /api/v1/modules/user-modules`, `GET /api/v1/connectors/premium`
   - `POST /api/v1/newsletter` (insertion)
5. Vérifier le dashboard (chargement user, modules, connecteurs, onboarding).

## Requêtes d’alignement SQL à prévoir (si vous validez)
- `users`: ajouter `fullName` si souhaité; vérifier présence `password` (pour login email). Sinon on s’adapte côté code à `name`.
- `modules`: ajouter `slug` unique (optionnel mais recommandé).
- `pricing`: si besoin, ajouter `type` (`module`/`connector`) et `key` (copie de `plan_name`) pour standardiser.

Confirmez que je procède avec cette injection et, si vous voulez, l’alignement SQL léger (ajout `slug`, `fullName`, `type`, `key`).