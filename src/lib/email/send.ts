import { sendEmail, isEmailConfigured } from "./templates";

export type SendOutcome =
  | { skipped: true; reason: "not-configured" | "send-failed" }
  | { skipped: false; messageId: string | null };

/** Sends ad-hoc HTML (admin broadcasts, purchase receipts). */
export async function sendRaw(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendOutcome> {
  if (!isEmailConfigured()) {
    console.log(`[email] skipped raw -> ${maskEmail(input.to)} (not configured)`);
    return { skipped: true, reason: "not-configured" };
  }

  try {
    const result = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    });
    return { skipped: false, messageId: result.messageId };
  } catch (error) {
    console.error("[email] sendRaw failed:", error instanceof Error ? error.message : error);
    throw error;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}