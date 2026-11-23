const SENDLIBERTY_URL = "https://sendliberty.com/api/send";

const BRAND = {
  bg: "#f7f7f5",
  surface: "#ffffff",
  fg: "#0a0a0a",
  muted: "#55554f",
  subtle: "#7c7c74",
  line: "#e3e3dd",
  accent: "#2563eb",
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

function emailShell(content: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg}; padding:0; margin:0;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:${BRAND.surface}; border:1px solid ${BRAND.line}; border-radius:10px;">
          ${content}
        </table>
      </td>
    </tr>
  </table>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "\u0026#38;";
    if (c === "<") return "\u0026#60;";
    if (c === ">") return "\u0026#62;";
    if (c === '"') return "\u0026#34;";
    if (c === "'") return "\u0026#39;";
    return c;
  });
}

function getApiKey(): string | null {
  return process.env.SENDLIBERTY_API_KEY?.trim() || null;
}

function getFrom(): string | null {
  return process.env.SENDLIBERTY_FROM?.trim() || null;
}

function isEmailConfigured(): boolean {
  return Boolean(getApiKey() && getFrom());
}

async function sendEmail(payload: Record<string, unknown>): Promise<{ messageId: string | null }> {
  const apiKey = getApiKey();
  const from = getFrom();
  if (!apiKey || !from) {
    throw new Error("SendLiberty not configured");
  }

  const res = await fetch(SENDLIBERTY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...payload }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SendLiberty ${res.status}: ${text}`);
  }

  const json = await res.json().catch(() => ({}));
  return { messageId: json.id || json.messageId || null };
}

export { sendEmail, getFrom, isEmailConfigured };

export const PRODUCT_NAME = "Acctrise";

export async function sendVerificationEmail({ email, name, link }: { email: string; name: string; link: string }) {
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Email verification</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Verify your email</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">Welcome to Acctrise</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 28px;">Hi ${escapeHtml(name)}, use the button below to verify your email address. This link expires in 24 hours.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${BRAND.accent}; border-radius:6px; padding:14px 24px;">
              <a href="${escapeHtml(link)}" style="font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">Verify email</a>
            </td>
          </tr>
        </table>
        <p style="font-family:${FONT}; font-size:13px; line-height:1.6; color:${BRAND.subtle}; margin:24px 0 0;">If the button doesn't work, copy this link: <br><a href="${escapeHtml(link)}" style="color:${BRAND.accent}; word-break:break-all;">${escapeHtml(link)}</a></p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to: email, subject: "Verify your Acctrise email", html });
}

export async function sendPasswordResetEmail({ email, name, link }: { email: string; name: string; link: string }) {
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Password reset</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Reset your password</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">Password reset requested</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 28px;">Hi ${escapeHtml(name)}, use the button below to set a new password. This link expires in 30 minutes.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${BRAND.accent}; border-radius:6px; padding:14px 24px;">
              <a href="${escapeHtml(link)}" style="font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">Reset password</a>
            </td>
          </tr>
        </table>
        <p style="font-family:${FONT}; font-size:13px; line-height:1.6; color:${BRAND.subtle}; margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to: email, subject: "Reset your Acctrise password", html });
}

export async function sendWelcomeEmail({ email, name }: { email: string; name: string }) {
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Welcome</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Your account is ready</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">Welcome to Acctrise, ${escapeHtml(name)}</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 20px;">Your email is verified and your account is active. You can now fund your wallet, buy services, and manage orders.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${BRAND.accent}; border-radius:6px; padding:14px 24px;">
              <a href="https://acctrise.com/dashboard" style="font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">Go to dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to: email, subject: "Welcome to Acctrise", html });
}

export async function sendAccountSuspendedEmail({ email, name, reason }: { email: string; name: string; reason: string }) {
  const supportUrl = `mailto:support@acctrise.com`;
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Account suspended</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Account status changed</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">Your account has been suspended</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 24px;">${escapeHtml(reason)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${BRAND.bg}; border:1px solid ${BRAND.line}; border-radius:6px; padding:16px 24px;">
              <a href="${escapeHtml(supportUrl)}" style="font-family:${FONT}; font-size:14px; font-weight:600; color:${BRAND.accent}; text-decoration:none;">Contact support</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to: email, subject: "Your Acctrise account has been suspended", html });
}

export async function sendPaymentSuccessEmail({ email, name, amount, product = "Wallet funding" }: { email: string; name: string; amount: string; product?: string }) {
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Payment successful</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Payment confirmed</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">Payment received</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 20px;">Hi ${escapeHtml(name)}, your payment for <strong>${escapeHtml(product)}</strong> has been confirmed.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr><td style="font-family:${FONT}; font-size:14px; color:${BRAND.muted}; padding:6px 0;"><strong style="color:${BRAND.fg};">Amount:</strong> ${escapeHtml(amount)}</td></tr>
          <tr><td style="font-family:${FONT}; font-size:14px; color:${BRAND.muted}; padding:6px 0;"><strong style="color:${BRAND.fg};">Product:</strong> ${escapeHtml(product)}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${BRAND.accent}; border-radius:6px; padding:14px 24px;">
              <a href="https://acctrise.com/dashboard/wallet" style="font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">View wallet</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to: email, subject: `Payment confirmed — ${amount}`, html });
}

export async function sendInvoiceEmail({ email, name, amount, invoiceId, date }: { email: string; name: string; amount: string; invoiceId: string; date: string }) {
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Invoice</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Payment receipt</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">Invoice for your wallet funding</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 20px;">Hi ${escapeHtml(name)}, thank you for funding your wallet.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed ${BRAND.line}; border-bottom:1px dashed ${BRAND.line}; margin-bottom:20px;">
          <tr><td style="font-family:${FONT}; font-size:13px; color:${BRAND.muted}; padding:8px 0;">Date</td><td align="right" style="font-family:${MONO}; font-size:13px; color:${BRAND.fg}; padding:8px 0; white-space:nowrap;">${escapeHtml(date)}</td></tr>
          <tr><td style="font-family:${FONT}; font-size:13px; color:${BRAND.muted}; padding:8px 0;">Invoice ID</td><td align="right" style="font-family:${MONO}; font-size:13px; color:${BRAND.fg}; padding:8px 0; white-space:nowrap;">${escapeHtml(invoiceId)}</td></tr>
          <tr><td style="font-family:${FONT}; font-size:13px; color:${BRAND.muted}; padding:8px 0;">Amount</td><td align="right" style="font-family:${MONO}; font-size:13px; color:${BRAND.fg}; padding:8px 0; white-space:nowrap;">${escapeHtml(amount)}</td></tr>
          <tr><td style="font-family:${FONT}; font-size:13px; color:${BRAND.muted}; padding:8px 0;"><strong style="color:${BRAND.fg};">Credited</strong></td><td align="right" style="font-family:${MONO}; font-size:13px; color:${BRAND.fg}; font-weight:600; padding:8px 0; white-space:nowrap;">${escapeHtml(amount)}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${BRAND.accent}; border-radius:6px; padding:14px 24px;">
              <a href="https://acctrise.com/dashboard/wallet" style="font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">View transaction</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to: email, subject: `Invoice — ${amount}`, html });
}

export async function sendPaymentFailedEmail({ email, name, amount, retryUrl }: { email: string; name: string; amount: string; retryUrl: string }) {
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Payment failed</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Action needed</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">Payment could not be processed</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 24px;">Your payment of <strong>${escapeHtml(amount)}</strong> was not successful. Please try again or use a different payment method.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${BRAND.accent}; border-radius:6px; padding:14px 24px;">
              <a href="${escapeHtml(retryUrl)}" style="font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">Retry payment</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to: email, subject: `Payment failed — ${amount}`, html });
}

export async function sendBroadcastEmail({ to, subject, message }: { to: string; subject: string; message: string }) {
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Announcement</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">${escapeHtml(subject)}</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to, subject, html });
}

export async function sendPurchaseReceipt({ to, title, details, amount, orderRef, balance }: {
  to: string; title: string; details: Array<{label: string; value: string}>; amount: string; orderRef: string; balance: string;
}) {
  const rows = details.map(d => `<tr><td style="font-family:${FONT}; font-size:14px; color:${BRAND.muted}; padding:4px 0;"><strong style="color:${BRAND.fg};">${escapeHtml(d.label)}:</strong> ${escapeHtml(d.value)}</td></tr>`).join("");
  const html = emailShell(`
    <tr>
      <td style="padding:24px 32px; border-bottom:1px solid ${BRAND.line};">
        <span style="font-family:${FONT}; font-size:16px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em;">Acctrise</span>
        <span style="font-family:${MONO}; font-size:10px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase;">&nbsp;Order receipt</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Thanks for your purchase</p>
        <h1 style="font-family:${FONT}; font-size:22px; font-weight:700; color:${BRAND.fg}; letter-spacing:-0.02em; margin:0 0 12px;">${escapeHtml(title)}</h1>
        <p style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${BRAND.muted}; margin:0 0 20px;">Your wallet was charged for this order. Details are below.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${rows}
          <tr><td style="font-family:${FONT}; font-size:14px; color:${BRAND.muted}; padding:4px 0;"><strong style="color:${BRAND.fg};">Charged:</strong> ${escapeHtml(amount)} NGN</td></tr>
          <tr><td style="font-family:${FONT}; font-size:14px; color:${BRAND.muted}; padding:4px 0;"><strong style="color:${BRAND.fg};">Reference:</strong> ${escapeHtml(orderRef)}</td></tr>
          <tr><td style="font-family:${FONT}; font-size:14px; color:${BRAND.muted}; padding:4px 0;"><strong style="color:${BRAND.fg};">Wallet balance:</strong> ${escapeHtml(balance)} NGN</td></tr>
        </table>
        <a href="https://acctrise.com/dashboard/orders" style="display:inline-block; background:${BRAND.accent}; color:#fff; font-family:${FONT}; font-size:14px; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:6px; margin-top:20px;">View in dashboard</a>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; border-top:1px solid ${BRAND.line};">
        <p style="font-family:${FONT}; font-size:12px; line-height:1.6; color:${BRAND.subtle}; margin:0;">Acctrise — Premium digital services.</p>
        <p style="font-family:${MONO}; font-size:11px; color:${BRAND.subtle}; margin:6px 0 0;">acctrise.com</p>
      </td>
    </tr>
  `);

  return sendEmail({ to, subject: `Your Acctrise receipt — ${title}`, html });
}