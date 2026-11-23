import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appUrl } from "@/lib/auth/app-url";
import { sendPasswordResetEmail } from "@/lib/email";
import { addMinutes, createSecureToken, hashSecureToken, normalizeEmail } from "@/lib/auth/security";
import { connectMongo } from "@/lib/mongodb";
import { PasswordResetToken } from "@/models/auth-token";
import { User } from "@/models/user";
import { clientIp, enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

const forgotPasswordSchema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail } = forgotPasswordSchema.parse(await request.json());
    await enforceRateLimit("forgot-password", clientIp(request.headers), 5, 60 * 60 * 1000);
    const email = normalizeEmail(rawEmail);
    await connectMongo();
    const user = await User.findOne({ email });

    if (user) {
      const token = createSecureToken();
      await PasswordResetToken.create({
        userId: user._id,
        token: hashSecureToken(token),
        expiresAt: addMinutes(new Date(), 30)
      });

      const resetUrl = appUrl(`/auth/reset-password?token=${token}`);
      const recipientName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || email.split("@")[0];

      // Response must not depend on delivery, and must not leak whether the address exists.
      after(() => sendPasswordResetEmail({ email, name: recipientName, link: resetUrl }));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to process password reset" }, { status: 500 });
  }
}
