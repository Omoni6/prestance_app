export default class ProfileService {
  async updateProfile(userId: number, fields: Record<string, any>) {
    return { success: true, userId, fields }
  }
  async updateAvatar(userId: number, avatarUrl: string) {
    return { success: true, userId, avatarUrl }
  }
}

