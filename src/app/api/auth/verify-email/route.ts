import { after, NextRequest, NextResponse } from "next/server";
import { hashSecureToken } from "@/lib/auth/security";
import { appUrl } from "@/lib/auth/app-url";
import { displayName, sendWelcomeEmail } from "@/lib/email";
import { connectMongo } from "@/lib/mongodb";
import { EmailVerificationToken } from "@/models/auth-token";
import { User } from "@/models/user";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.redirect(appUrl("/auth/login?verified=missing"));
    }

    await connectMongo();
    const record = await EmailVerificationToken.findOne({ token: { $in: [hashSecureToken(token), token] } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.redirect(appUrl("/auth/login?verified=invalid"));
    }

    const user = await User.findOneAndUpdate(
      { _id: record.userId },
      { $set: { emailVerified: new Date() } },
      { new: true }
    ).select("email firstName lastName username").lean();

    record.usedAt = new Date();
    await record.save();

    if (user?.email) {
      after(() => sendWelcomeEmail({ email: user.email, name: displayName(user) }));
    }

    return NextResponse.redirect(appUrl("/auth/login?verified=success"));
  } catch {
    return NextResponse.redirect(appUrl("/auth/login?verified=error"));
  }
}
