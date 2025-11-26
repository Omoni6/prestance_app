import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class OnboardingController {
  public async get({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const u = await User.find(user.id)
      return response.ok({ completed: !!u?.onboardingCompleted })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async save({ auth, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const data = request.all()
      return response.ok({ success: true, data })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async complete({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      await User.query().where('id', user.id).update({ onboardingCompleted: true })
      return response.ok({ success: true, completed: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
