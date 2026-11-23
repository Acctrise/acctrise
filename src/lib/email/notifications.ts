import { appUrl } from "@/lib/auth/app-url";
import { connectMongo } from "@/lib/mongodb";
import { getTransactionNotificationContext } from "@/lib/services/mongo-wallet-service";
import { User } from "@/models/user";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAccountSuspendedEmail,
  sendPaymentSuccessEmail,
  sendInvoiceEmail,
  sendPaymentFailedEmail,
} from "./templates";

export interface EmailRecipient {
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

export function displayName(user: EmailRecipient): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.name) return user.name;
  if (user.username) return user.username;
  return user.email.split("@")[0] || "there";
}

export function formatNaira(cents: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Math.max(cents, 0) / 100);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(value);
}

async function safe(label: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    console.error(`[email/${label}]`, error instanceof Error ? error.message : error);
  }
}

export async function sendVerificationEmailWrapper(input: { email: string; name: string; link: string }) {
  return safe("verify-email", () => sendVerificationEmail(input));
}

export async function sendPasswordResetEmailWrapper(input: { email: string; name: string; link: string }) {
  return safe("password-reset", () => sendPasswordResetEmail(input));
}

export async function sendWelcomeEmailWrapper(input: { email: string; name: string }) {
  return safe("welcome", () => sendWelcomeEmail(input));
}

export async function sendAccountSuspendedEmailWrapper(input: { email: string; name: string; reason: string }) {
  return safe("account-suspended", () => sendAccountSuspendedEmail(input));
}

async function recipientForTransaction(reference: string) {
  const context = await getTransactionNotificationContext(reference);
  if (!context) return null;

  await connectMongo();
  const user = await User.findById(context.userId).select("email firstName lastName username").lean();
  if (!user) return null;

  return { context, user };
}

export async function notifyPaymentCompleted(reference: string) {
  return safe("payment-completed", async () => {
    const found = await recipientForTransaction(reference);
    if (!found) return;

    const { context, user } = found;
    const name = displayName(user);
    const amount = formatNaira(context.netAmountCents);

    // Sequential sends to respect Gmail's 1/sec burst limit
    await sendPaymentSuccessEmail({ email: user.email, name, amount, product: "Wallet funding" });
    await sendInvoiceEmail({ email: user.email, name, amount, invoiceId: context.reference, date: formatDate(context.createdAt) });
  });
}

export async function notifyPaymentFailed(reference: string) {
  return safe("payment-failed", async () => {
    const found = await recipientForTransaction(reference);
    if (!found) return;

    const { context, user } = found;
    await sendPaymentFailedEmail({
      email: user.email,
      name: displayName(user),
      amount: formatNaira(context.amountCents),
      retryUrl: appUrl("/dashboard/wallet")
    });
  });
}