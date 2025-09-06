import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'kuSystem <noreply@send.kusystem.ddns.net>'

let resend: Resend | null = null
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY)
}

export async function sendInvitationEmail(to: string, orgName: string, inviteUrl: string) {
  if (!resend) {
    console.log('[email:dev] Missing RESEND_API_KEY. Printing invite instead:', { to, orgName, inviteUrl })
    return { id: 'dev', status: 'logged' as const }
  }
  const subject = `Invitación a ${orgName} en kuSystem`
  const html = `
    <p>Has sido invitado a unirte a <strong>${orgName}</strong> en kuSystem.</p>
    <p>
      <a href="${inviteUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:10px 16px;background:#2563EB;color:white;border-radius:6px;text-decoration:none">Aceptar invitación</a>
    </p>
    <p>Si no puedes abrir el botón, copia y pega este enlace en tu navegador: <br />
      <code>${inviteUrl}</code>
    </p>
  `
  console.log('[email] Sending invite via Resend...', { to, from: EMAIL_FROM, subject })
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    })
    // Resend v6: { data?: { id: string }, error?: any }
    if ((result as any)?.data?.id) {
      console.log('[email] Resend sent OK', { id: (result as any).data.id })
    }
    if ((result as any)?.error) {
      console.error('[email] Resend send error', (result as any).error)
    }
    return result
  } catch (err) {
    console.error('[email] Resend exception', err)
    throw err
  }
}
