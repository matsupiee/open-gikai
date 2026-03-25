import type { Auth } from "@open-gikai/auth";
import type { Db } from "@open-gikai/db";
import type { Db as MinutesDb } from "@open-gikai/db-minutes";

export interface CreateContextParams {
  req: Request;
  auth: Auth;
  db: Db;
  minutesDb: MinutesDb;
}

/**
 * フロントから認証トークンつきでアクセスする際に使う
 */
export async function createContext({ req, auth, db, minutesDb }: CreateContextParams) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    session,
    db,
    minutesDb,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
