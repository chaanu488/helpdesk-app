import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

const FROM = process.env.SMTP_FROM ?? 'Helpdesk <noreply@helpdesk.local>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email] Failed to send email to', to, err);
  }
}

export const emailTemplates = {
  inviteUser(role: string, token: string) {
    const link = `${APP_URL}/invite/${token}`;
    return {
      subject: `You've been invited to Helpdesk`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>You've been invited to join Helpdesk</h2>
          <p>You've been invited as a <strong>${role}</strong>.</p>
          <p>Click the link below to accept your invitation and set up your account:</p>
          <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
            Accept Invitation
          </a>
          <p style="color:#666;font-size:14px">This link expires in 7 days. If you didn't expect this invitation, ignore this email.</p>
        </div>
      `,
    };
  },

  forgotPassword(token: string) {
    const link = `${APP_URL}/reset-password/${token}`;
    return {
      subject: 'Reset your Helpdesk password',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>Reset your password</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
            Reset Password
          </a>
          <p style="color:#666;font-size:14px">This link expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
        </div>
      `,
    };
  },

  ticketCreated(ticketNumber: number, title: string, ticketId: string) {
    const link = `${APP_URL}/tickets/${ticketId}`;
    return {
      subject: `Ticket #${ticketNumber} created: ${title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>Your ticket has been received</h2>
          <p>Ticket <strong>#${ticketNumber}</strong>: ${title}</p>
          <p>Our team will respond shortly.</p>
          <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
            View Ticket
          </a>
        </div>
      `,
    };
  },

  ticketReply(ticketNumber: number, title: string, ticketId: string, replyPreview: string) {
    const link = `${APP_URL}/tickets/${ticketId}`;
    const preview = replyPreview.replace(/<[^>]+>/g, '').substring(0, 300);
    return {
      subject: `New reply on ticket #${ticketNumber}: ${title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>New reply on your ticket</h2>
          <p>Ticket <strong>#${ticketNumber}</strong>: ${title}</p>
          <blockquote style="border-left:3px solid #ccc;padding-left:16px;color:#444;margin:16px 0">
            ${preview}${replyPreview.length > 300 ? '...' : ''}
          </blockquote>
          <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
            View Ticket
          </a>
        </div>
      `,
    };
  },

  ticketStatusChanged(ticketNumber: number, title: string, ticketId: string, newStatus: string) {
    const link = `${APP_URL}/tickets/${ticketId}`;
    return {
      subject: `Ticket #${ticketNumber} status updated: ${newStatus.replace('_', ' ')}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>Ticket status updated</h2>
          <p>Ticket <strong>#${ticketNumber}</strong>: ${title}</p>
          <p>Status changed to: <strong>${newStatus.replace('_', ' ')}</strong></p>
          <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
            View Ticket
          </a>
        </div>
      `,
    };
  },

  ticketAssigned(agentName: string, ticketNumber: number, title: string, ticketId: string) {
    const link = `${APP_URL}/tickets/${ticketId}`;
    return {
      subject: `Ticket #${ticketNumber} assigned to you`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>A ticket has been assigned to you</h2>
          <p>Hi ${agentName},</p>
          <p>Ticket <strong>#${ticketNumber}</strong>: ${title} has been assigned to you.</p>
          <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
            View Ticket
          </a>
        </div>
      `,
    };
  },
};
