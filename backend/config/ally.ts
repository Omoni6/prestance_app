import { defineConfig, services } from '@adonisjs/ally'
import env from '#start/env'

const rawCallback = env.get('GOOGLE_REDIRECT_URI')
const safeCallback =
  rawCallback && rawCallback.includes('localhost:3003')
    ? 'http://localhost:3333/api/v1/auth/google/callback'
    : rawCallback || 'http://localhost:3333/api/v1/auth/google/callback'

const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID'),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET'),
    callbackUrl: safeCallback,
    scopes: ['profile', 'email'],
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
