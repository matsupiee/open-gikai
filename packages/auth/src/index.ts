import type { Db } from "@open-gikai/db";
import * as schema from "@open-gikai/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Resend } from "resend";
import { isAllowedEmailDomain } from "./allowed-email-domains";

export interface CreateAuthOptions {
  db: Db;
  trustedOrigins: string;
  resendApiKey: string;
  emailFrom: string;
}

export function createAuth({
  db,
  trustedOrigins,
  resendApiKey,
  emailFrom,
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
      sendVerificationEmail: async ({ user, url }) => {
        if (!isAllowedEmailDomain(user.email)) {
          throw new Error("許可されていないメールドメインです");
        }
        void resend.emails.send({
          from: emailFrom,
          to: user.email,
          subject: "【open-gikai】メールアドレスの確認",
          html: `
            <p>${user.name ?? ""} 様</p>
            <p>open-gikai にご登録いただきありがとうございます。</p>
            <p>以下のリンクをクリックしてメールアドレスを確認してください。</p>
            <p><a href="${url}">メールアドレスを確認する</a></p>
            <p>このメールに心当たりがない場合は無視してください。</p>
          `,
        });
      },
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
    },
    plugins: [tanstackStartCookies(), admin({ defaultRole: "user" })],
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
