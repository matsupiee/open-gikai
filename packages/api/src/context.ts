import type { Auth } from "@open-gikai/auth";
import type { Db } from "@open-gikai/db-auth";
import type { ShardedMinutesDb } from "@open-gikai/db-minutes";

export interface CreateContextParams {
  req: Request;
  auth: Auth;
  authDb: Db;
  shardedMinutesDb: ShardedMinutesDb;
}

/**
 * フロントから認証トークンつきでアクセスする際に使う
 */
export async function createContext({ req, auth, authDb, shardedMinutesDb }: CreateContextParams) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    session,
    authDb,
    shardedMinutesDb,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
