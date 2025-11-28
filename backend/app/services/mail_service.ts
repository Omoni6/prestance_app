import tls from 'node:tls'

type SmtpConfig = { host: string; port: number; user: string; pass: string; from: string }

function env(key: string, fallback = '') { const v = process.env[key]; return typeof v === 'string' && v.length ? v : fallback }

export default class MailService {
  cfg: SmtpConfig
  constructor() {
    this.cfg = {
      host: env('SMTP_HOST', 'smtp.hostinger.com'),
      port: Number(env('SMTP_PORT', '587')),
      user: env('SMTP_USER', ''),
      pass: env('SMTP_PASSWORD', ''),
      from: env('SMTP_FROM', 'O\'moni <noreply@omoniprestanceholding.com>'),
    }
  }

  async send(to: string, subject: string, text: string) {
    const { host, port, user, pass, from } = this.cfg
    const socket = tls.connect({ host, port, rejectUnauthorized: false })
    const write = (s: string) => new Promise<void>((resolve) => { socket.write(s + '\r\n', () => resolve()) })
    const read = () => new Promise<string>((resolve) => { socket.once('data', (d) => resolve(String(d))) })
    try {
      await read() // server banner
      await write(`EHLO omoni`) ; await read()
      await write(`AUTH LOGIN`) ; await read()
      await write(Buffer.from(user).toString('base64')) ; await read()
      await write(Buffer.from(pass).toString('base64')) ; await read()
      await write(`MAIL FROM:<${user}>`) ; await read()
      await write(`RCPT TO:<${to}>`) ; await read()
      await write(`DATA`) ; await read()
      const msg = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        text,
        ``,
        `.`,
      ].join('\r\n')
      await write(msg) ; await read()
      await write(`QUIT`)
      socket.end()
      return { success: true }
    } catch {
      try { socket.end() } catch {}
      return { success: false }
    }
  }
}

