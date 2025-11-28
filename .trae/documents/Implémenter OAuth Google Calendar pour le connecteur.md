## Objectif
Mettre en place l’authentification des connecteurs (en commençant par Google Calendar) et ajouter un agent vocal Realtime (orbe) dans le dashboard, capable de recevoir des ordres vocaux et d’appeler nos APIs.

## Pré-requis
- Variables déjà présentes: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL`, `FRONTEND_URL`, `OPENAI_API_KEY`.
- Routes existantes pour les connecteurs (`redirect`/`callback`) et modules.

## Connecteur Google Calendar (OAuth)
1. Migration `user_connector_credentials`:
   - Colonnes: `id`, `user_id (FK users)`, `connector_code` (`google_calendar`), `provider` (`google`), `access_token`, `refresh_token`, `expires_at`, `extra_json`, timestamps
   - Contrainte unique `(user_id, connector_code)`
2. Service `ConnectorAuthService`:
   - `saveTokens(userId, connectorCode, tokens)`
   - `getOAuthClient(userId, connectorCode)` (reconstruit un OAuth2 client, gère refresh)
   - `revoke(userId, connectorCode)`
3. ConnectorsController:
   - `GET /api/v1/connectors/google_calendar/redirect` (auth requis): crée l’URL d’autorisation Google avec scopes minimalistes `['https://www.googleapis.com/auth/calendar.readonly']`, `access_type='offline'`, `prompt='consent'`
   - `GET /api/v1/connectors/google_calendar/callback` (auth requis): échange `code`→`tokens`, persiste, active `user_connectors`, redirige vers `FRONTEND_URL/connectors/callback/google_calendar?status=success`
4. Dashboard:
   - Clic icône `google_calendar` → ouvre `redirect`
   - Après retour, rafraîchit l’état et marque `connected=true`

## Autres connecteurs (généralisation)
- OAuth (Gmail, Slack, Notion, Calendly): même endpoints `redirect/callback`, scopes minimaux par connecteur.
- Config/API key (SMTP, Twilio, MinIO, Hostinger): endpoint `POST /api/v1/connectors/:key/config` (auth), persiste dans `user_connector_credentials.extra_json`, active le connecteur.
- Endpoint `POST /api/v1/connectors/:key/revoke`: désactive le connecteur et purge les credentials.

## Voice Agent Realtime (OpenAI) dans le Dashboard
1. Endpoint backend pour clé éphémère:
   - `POST /api/v1/realtime/client-secret` (auth requis): appelle `POST https://api.openai.com/v1/realtime/client_secrets` avec `OPENAI_API_KEY`, payload type `realtime`, model `gpt-realtime`, voix `marin`; retourne `value` (client secret) au front.
2. Composant UI "Orbe Voice":
   - Utilise `@openai/agents/realtime` (WebRTC) côté navigateur.
   - Initialise `RealtimeAgent` + `RealtimeSession` avec prompt "Donna".
   - `session.connect({ apiKey: <client-secret éphémère> })`; micro et audio out automatiques.
3. Tools du Voice Agent (coté serveur/front):
   - `activate_connector(key)`, `upload_file`, `create_project`, `list_connectors`, `list_events`, etc.
   - Chaque tool appelle nos endpoints REST existants.
4. Sécurité:
   - Auth front pour obtenir le client secret.
   - Durée courte des clés; rate-limit; aucune exposition `OPENAI_API_KEY` côté client.

## Tests & Validation
- Parcours e2e Google Calendar: redirect → consent → callback → tokens stockés → connecteur actif.
- Voice Agent: obtention client secret → connexion WebRTC → ordre vocal (ex: "Active Google Calendar") → réponse audio/texte; vérification via nos routes.
- Vérifications DB (`user_connectors`, `user_connector_credentials`).

## Livrables
- Migration + service + mises à jour contrôleur/routes côté backend.
- Composant orbe voice côté frontend + endpoint éphémère.
- Documentation d’usage (scopes, endpoints, flux UI).

Confirme que je lance l’implémentation selon ce plan (Google Calendar d’abord, puis Voice Agent avec le set minimal de tools).