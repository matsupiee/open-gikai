import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [adminClient()],
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
});
