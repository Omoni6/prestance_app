export default class StripeService {
  async createCheckoutSession(userId: number, priceId: string) {
    return { success: true, userId, priceId, url: null }
  }
}

