/**
 * Fix Failed Migration Script
 * Resolves the failed 20251030_add_chat_priority_enum migration
 */

const { PrismaClient } = require('@prisma/client');

async function fixFailedMigration() {
  const prisma = new PrismaClient();

  try {
    console.log('🔌 Checking for failed migrations...');

    // Check if migration exists and is failed
    const result = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = '20251030_add_chat_priority_enum'
    `;

    if (result.length === 0) {
      console.log('✅ No failed migration found - proceeding normally');
      await prisma.$disconnect();
      return;
    }

    const migration = result[0];

    if (migration.finished_at && !migration.rolled_back_at) {
      console.log('✅ Migration already applied successfully');
      await prisma.$disconnect();
      return;
    }

    // Mark as rolled back
    await prisma.$executeRaw`
      UPDATE "_prisma_migrations"
      SET rolled_back_at = NOW()
      WHERE migration_name = '20251030_add_chat_priority_enum'
      AND finished_at IS NULL
    `;

    console.log('✅ Failed migration marked as rolled back');

    await prisma.$disconnect();
    console.log('✅ Migration fix complete - ready to re-apply');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing migration:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixFailedMigration();
