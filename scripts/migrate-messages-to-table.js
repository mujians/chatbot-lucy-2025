/**
 * BUG #6: Data Migration Script
 *
 * Migrates messages from ChatSession.messages (JSON) to Message table
 *
 * USAGE:
 *   node scripts/migrate-messages-to-table.js
 *
 * IMPORTANT:
 *   - Run AFTER applying the database migration (20251029_add_message_table)
 *   - This script is idempotent - safe to run multiple times
 *   - Does NOT delete the old JSON field (kept for backup)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateMessages() {
  console.log('🚀 Starting message migration from JSON to Message table...\n');

  try {
    // Get all chat sessions
    const sessions = await prisma.chatSession.findMany({
      select: {
        id: true,
        messages: true,
        operatorId: true,
      },
    });

    console.log(`📊 Found ${sessions.length} chat sessions\n`);

    let totalMessages = 0;
    let totalSessions = 0;
    let errors = 0;

    for (const session of sessions) {
      try {
        // Parse messages JSON
        let messages = [];
        try {
          messages = JSON.parse(session.messages);
          if (!Array.isArray(messages)) {
            console.warn(`⚠️  Session ${session.id}: messages is not an array, skipping`);
            continue;
          }
        } catch (error) {
          console.error(`❌ Session ${session.id}: Failed to parse messages JSON, skipping`);
          errors++;
          continue;
        }

        if (messages.length === 0) {
          continue; // Skip sessions with no messages
        }

        // Check if messages already migrated
        const existingMessages = await prisma.message.count({
          where: { sessionId: session.id },
        });

        if (existingMessages > 0) {
          console.log(`⏭️  Session ${session.id}: Already has ${existingMessages} messages in table, skipping`);
          continue;
        }

        // Migrate each message
        const messagesToCreate = messages.map((msg, index) => {
          // Determine message type
          let messageType = 'SYSTEM';
          if (msg.type === 'user') messageType = 'USER';
          else if (msg.type === 'operator') messageType = 'OPERATOR';
          else if (msg.type === 'ai' || msg.type === 'bot') messageType = 'AI';
          else if (msg.type === 'system') messageType = 'SYSTEM';

          // Parse timestamp - use index if timestamp is missing
          let createdAt;
          if (msg.timestamp) {
            createdAt = new Date(msg.timestamp);
            if (isNaN(createdAt.getTime())) {
              // Invalid timestamp, use index-based offset
              createdAt = new Date(Date.now() - (messages.length - index) * 1000);
            }
          } else {
            // No timestamp, use index-based offset
            createdAt = new Date(Date.now() - (messages.length - index) * 1000);
          }

          return {
            id: msg.id || `migrated_${session.id}_${index}`,
            sessionId: session.id,
            type: messageType,
            content: msg.content || '',
            operatorId: msg.operatorId || null,
            operatorName: msg.operatorName || null,
            aiConfidence: msg.confidence || null,
            aiSuggestOperator: msg.suggestOperator || false,
            attachmentUrl: msg.attachment?.url || null,
            attachmentPublicId: msg.attachment?.publicId || null,
            attachmentName: msg.attachment?.originalName || null,
            attachmentMimetype: msg.attachment?.mimetype || null,
            attachmentResourceType: msg.attachment?.resourceType || null,
            attachmentSize: msg.attachment?.size || null,
            createdAt,
          };
        });

        // Create all messages in a transaction
        await prisma.$transaction(
          messagesToCreate.map((msg) =>
            prisma.message.create({
              data: msg,
            })
          )
        );

        totalMessages += messagesToCreate.length;
        totalSessions++;

        console.log(`✅ Session ${session.id}: Migrated ${messagesToCreate.length} messages`);

      } catch (error) {
        console.error(`❌ Session ${session.id}: Migration failed - ${error.message}`);
        errors++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✨ MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`Total sessions processed: ${sessions.length}`);
    console.log(`Sessions migrated: ${totalSessions}`);
    console.log(`Total messages migrated: ${totalMessages}`);
    console.log(`Errors: ${errors}`);
    console.log('═══════════════════════════════════════\n');

    if (errors === 0) {
      console.log('🎉 All messages migrated successfully!');
      console.log('\n📝 NEXT STEPS:');
      console.log('1. Verify data in Message table');
      console.log('2. Update controllers to use Message model');
      console.log('3. Test thoroughly before deploying');
      console.log('4. Once confirmed working, the JSON field can be kept as backup');
    } else {
      console.log('⚠️  Some sessions had errors. Please review and fix manually.');
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR during migration:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateMessages().catch(console.error);
