import tls from 'node:tls'
import net from 'node:net'

type SmtpConfig = { host: string; port: number; user: string; pass: string; from: string }

function env(key: string, fallback = '') { const v = process.env[key]; return typeof v === 'string' && v.length ? v : fallback }

export default class MailService {
  cfg: SmtpConfig
  constructor(cfg?: Partial<SmtpConfig>) {
    const base: SmtpConfig = {
      host: env('SMTP_HOST', 'smtp.hostinger.com'),
      port: Number(env('SMTP_PORT', '587')),
      user: env('SMTP_USER', ''),
      pass: env('SMTP_PASSWORD', ''),
      from: env('SMTP_FROM', 'O\'moni <noreply@omoniprestanceholding.com>'),
    }
    this.cfg = {
      host: String(cfg?.host ?? base.host),
      port: Number(cfg?.port ?? base.port),
      user: String(cfg?.user ?? base.user),
      pass: String(cfg?.pass ?? base.pass),
      from: String(cfg?.from ?? base.from),
    }
    if (this.cfg.host === 'smtp.gmail.com' && this.cfg.port === 587) {
      this.cfg.port = 465 // implicit TLS, compatible avec implémentation actuelle
    }
  }

  async send(to: string, subject: string, text: string) {
    const { host, port, user, pass, from } = this.cfg
    const { socket, write, read } = await this.connectSmtp(host, port)
    try {
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

  async sendWithAttachments(to: string, subject: string, text: string, attachments: Array<{ filename: string; mime: string; content: Buffer }>) {
    const { host, port, user, pass, from } = this.cfg
    const { socket, write, read } = await this.connectSmtp(host, port)
    const boundary = '----omoni-boundary-' + Math.random().toString(36).slice(2)
    try {
      await read() ; await write(`EHLO omoni`) ; await read()
      await write(`AUTH LOGIN`) ; await read()
      await write(Buffer.from(user).toString('base64')) ; await read()
      await write(Buffer.from(pass).toString('base64')) ; await read()
      await write(`MAIL FROM:<${user}>`) ; await read()
      await write(`RCPT TO:<${to}>`) ; await read()
      await write(`DATA`) ; await read()
      const header = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary=${boundary}`,
        ``,
      ].join('\r\n')
      const parts: string[] = []
      parts.push(`--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n`)
      for (const att of attachments) {
        const b64 = att.content.toString('base64')
        parts.push(`--${boundary}\r\nContent-Type: ${att.mime}\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${att.filename}"\r\n\r\n${b64}\r\n`)
      }
      parts.push(`--${boundary}--`)
      const msg = header + parts.join('') + '\r\n.'
      await write(msg) ; await read()
      await write(`QUIT`) ; socket.end()
      return { success: true }
    } catch {
      try { socket.end() } catch {}
      return { success: false }
    }
  }

  private async connectSmtp(host: string, port: number): Promise<{ socket: tls.TLSSocket; write: (s: string) => Promise<void>; read: () => Promise<string> }> {
    if (port === 465) {
      const socket = tls.connect({ host, port, rejectUnauthorized: false })
      await new Promise<void>((resolve) => socket.once('secureConnect', () => resolve()))
      const write = (s: string) => new Promise<void>((resolve) => { socket.write(s + '\r\n', () => resolve()) })
      const read = () => new Promise<string>((resolve) => { socket.once('data', (d) => resolve(String(d))) })
      // read initial banner
      try { await read() } catch {}
      return { socket, write, read }
    }
    // STARTTLS flow on 587
    const plain = net.connect({ host, port })
    const writePlain = (s: string) => new Promise<void>((resolve) => { plain.write(s + '\r\n', () => resolve()) })
    const readPlain = () => new Promise<string>((resolve) => { plain.once('data', (d) => resolve(String(d))) })
    await new Promise<void>((resolve) => plain.once('connect', () => resolve()))
    try { await readPlain() } catch {}
    await writePlain(`EHLO omoni`) ; await readPlain()
    await writePlain(`STARTTLS`) ; await readPlain()
    const socket = tls.connect({ socket: plain, servername: host, rejectUnauthorized: false })
    await new Promise<void>((resolve) => socket.once('secureConnect', () => resolve()))
    const write = (s: string) => new Promise<void>((resolve) => { socket.write(s + '\r\n', () => resolve()) })
    const read = () => new Promise<string>((resolve) => { socket.once('data', (d) => resolve(String(d))) })
    return { socket, write, read }
  }
}
