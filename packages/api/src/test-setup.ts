import {
  createTestDatabase,
  getTestDb,
  runMigrations,
  closeTestDb,
} from "@open-gikai/db/test-helpers";

export async function setup() {
  await createTestDatabase();
  const db = getTestDb();
  await runMigrations(db);
  await closeTestDb(db);
}
