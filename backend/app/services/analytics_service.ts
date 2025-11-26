export default class AnalyticsService {
  async logEvent(userId: number, name: string, properties: Record<string, any> = {}) {
    return { success: true, userId, name, properties }
  }
  async getSummary(userId: number) {
    return { events: 0, userId }
  }
}

