import {
  createTestDatabase,
  getTestDb,
  runMigrations,
  closeTestDb,
} from "@open-gikai/db/test-helpers";

export async function setup() {
  console.log("[test-setup] Creating test database...");
  await createTestDatabase();
  console.log("[test-setup] Running migrations...");
  const db = getTestDb();
  await runMigrations(db);
  console.log("[test-setup] Migrations complete.");
  await closeTestDb(db);
}
