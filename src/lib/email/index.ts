export { EmailError, getBatch, submitBatch, isConfigured, type BatchProgress, type BatchRecipient, sendRaw } from "./client";
export { sendRaw as sendRawExport, type SendOutcome } from "./send";
export {
  displayName,
  formatNaira,
  notifyPaymentCompleted,
  notifyPaymentFailed,
  sendAccountSuspendedEmailWrapper as sendAccountSuspendedEmail,
  sendPasswordResetEmailWrapper as sendPasswordResetEmail,
  sendVerificationEmailWrapper as sendVerificationEmail,
  sendWelcomeEmailWrapper as sendWelcomeEmail,
} from "./notifications";
export { PRODUCT_NAME, isEmailConfigured, getFrom, sendBroadcastEmail, sendPurchaseReceipt } from "./templates";