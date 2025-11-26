export default class OnboardingService {
  async save(userId: number, data: Record<string, any>) {
    return { success: true, userId, data }
  }
}

