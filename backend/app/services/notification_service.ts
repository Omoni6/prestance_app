export default class NotificationService {
  async sendEmail(to: string, subject: string, _body: string) {
    return { success: true, to, subject }
  }
  async sendTelegram(chatId: string, _text: string) {
    return { success: true, chatId }
  }
}
