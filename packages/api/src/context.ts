import type { Auth } from "@open-gikai/auth";
import type { Db } from "@open-gikai/db-auth";
import type { MinutesDb } from "@open-gikai/db-minutes";

export interface CreateContextParams {
  req: Request;
  auth: Auth;
  authDb: Db;
  minutesDb: MinutesDb;
}

/**
 * フロントから認証トークンつきでアクセスする際に使う
 */
export async function createContext({ req, auth, authDb, minutesDb }: CreateContextParams) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    session,
    authDb,
    minutesDb,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
