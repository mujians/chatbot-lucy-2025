/**
 * Fix Failed Migration Script
 * Resolves the failed 20251030_add_chat_priority_enum migration
 */

const { Client } = require('pg');

async function fixFailedMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔌 Connected to database');

    // Check if migration exists and is failed
    const result = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = '20251030_add_chat_priority_enum'
    `);

    if (result.rows.length === 0) {
      console.log('✅ No failed migration found - proceeding normally');
      await client.end();
      return;
    }

    const migration = result.rows[0];

    if (migration.finished_at && !migration.rolled_back_at) {
      console.log('✅ Migration already applied successfully');
      await client.end();
      return;
    }

    // Mark as rolled back
    await client.query(`
      UPDATE "_prisma_migrations"
      SET rolled_back_at = NOW()
      WHERE migration_name = '20251030_add_chat_priority_enum'
      AND finished_at IS NULL
    `);

    console.log('✅ Failed migration marked as rolled back');

    await client.end();
    console.log('✅ Migration fix complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing migration:', error.message);
    await client.end();
    process.exit(1);
  }
}

fixFailedMigration();
