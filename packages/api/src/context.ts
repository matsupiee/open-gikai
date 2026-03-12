import type { Auth } from "@open-gikai/auth";
import type { Db } from "@open-gikai/db";

export interface CreateContextParams {
  req: Request;
  auth: Auth;
  db: Db;
}

/**
 * フロントから認証トークンつきでアクセスする際に使う
 */
export async function createContext({ req, auth, db }: CreateContextParams) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    session,
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
