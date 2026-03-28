import type { Db } from "@open-gikai/db";
import * as schema from "@open-gikai/db/schema";
import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Resend } from "resend";
import { isAllowedEmailDomain } from "./allowed-email-domains";

const EMAIL_FROM = "noreplay@opengikai.com";

export interface CreateAuthOptions {
  db: Db;
  trustedOrigins: string;
  resendApiKey: string;
}

export function createAuth({
  db,
  trustedOrigins,
  resendApiKey,
}: CreateAuthOptions) {
  const resend = new Resend(resendApiKey);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
      usePlural: true,
    }),
    trustedOrigins: [trustedOrigins],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const email = ctx.body?.email;
        if (typeof email === "string" && !isAllowedEmailDomain(email)) {
          throw new APIError("BAD_REQUEST", {
            message: "許可されていないメールドメインです",
          });
        }
      }),
    },
    plugins: [
      tanstackStartCookies(),
      admin({ defaultRole: "user" }),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        sendVerificationOnSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification") return;
          await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject: "【open-gikai】確認コード",
            html: `
              <p>open-gikai の確認コードは以下のとおりです。</p>
              <p style="font-size: 32px; font-weight: bold; letter-spacing: 0.3em;">${otp}</p>
              <p>このコードは10分間有効です。</p>
              <p>このメールに心当たりがない場合は無視してください。</p>
            `,
          });
        },
      }),
    ],
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
