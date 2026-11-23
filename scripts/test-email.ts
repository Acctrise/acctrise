import "dotenv/config";
import { sendRaw } from "@/lib/email/send";
import { isConfigured } from "@/lib/email/client";

async function testEmail() {
  console.log("Testing SendLiberty email configuration...");

  if (!isConfigured()) {
    console.error("❌ SendLiberty not configured - check SENDLIBERTY_API_KEY and SENDLIBERTY_FROM");
    process.exit(1);
  }

  console.log("✅ Configuration found");
  console.log("Sending test email to omaaa.shop@gmail.com...");

  try {
    const result = await sendRaw({
      to: "omaaa.shop@gmail.com",
      subject: "Test email from Acctrise (SendLiberty)",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">
          <p>Hi there,</p>
          <p>This is a test email from <strong>Acctrise</strong> sent via <strong>SendLiberty</strong>.</p>
          <p>If you received this, the email integration is working correctly.</p>
          <p style="color:#64748b;font-size:12px">Sent from Acctrise admin test script</p>
        </div>
      `,
      text: "Hi there,\n\nThis is a test email from Acctrise sent via SendLiberty.\nIf you received this, the email integration is working correctly."
    });

    if (result.skipped) {
      console.error("❌ Email was skipped:", result.reason);
      process.exit(1);
    }

    console.log("✅ Test email sent successfully!");
    console.log("   Message ID:", result.messageId);
  } catch (error) {
    console.error("❌ Failed to send test email:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testEmail().then(() => {
  console.log("Done");
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});