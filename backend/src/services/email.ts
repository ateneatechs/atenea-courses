// Transactional email via SMTP (Gmail or any SMTP provider).
// Configure with EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASS/EMAIL_FROM in .env.
// Failures are logged and swallowed — a flaky email send must never block payment processing.
import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
let warnedMissingConfig = false;

const getTransporter = (): Transporter | null => {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT) || 465;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    if (!warnedMissingConfig) {
      console.warn('Email service not configured (EMAIL_USER/EMAIL_PASS missing) — skipping email sends.');
      warnedMissingConfig = true;
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
};

const formatARS = (amount: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

interface OrderConfirmationArgs {
  to: string;
  userName: string;
  tenantName: string;
  itemTitle: string;
  amount: number;
  paymentId: string;
  purchasedAt: Date;
}

export const sendOrderConfirmationEmail = async (args: OrderConfirmationArgs): Promise<void> => {
  const t = getTransporter();
  if (!t) return;

  const dateStr = args.purchasedAt.toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">¡Gracias por tu compra, ${args.userName}!</h2>
      <p style="color: #555;">Tu orden en <strong>${args.tenantName}</strong> fue completada con éxito.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Producto</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${args.itemTitle}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Monto</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatARS(args.amount)}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Fecha</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${dateStr}</td></tr>
        <tr><td style="padding: 8px 0; color: #555;">N° de pago</td>
            <td style="padding: 8px 0; text-align: right;">${args.paymentId}</td></tr>
      </table>
      <p style="color: #555; font-size: 14px;">Conservá este email como comprobante de tu compra. Ya podés acceder a tu contenido desde la sección "Mis Cursos".</p>
    </div>
  `;

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: args.to,
      subject: `Tu orden fue completada — ${args.itemTitle}`,
      html,
    });
  } catch (error) {
    console.error('sendOrderConfirmationEmail error:', error);
  }
};
