-- AlterTable
-- v2.3.4: Add closureReason field to track why chats were closed
ALTER TABLE "ChatSession" ADD COLUMN "closureReason" TEXT;

-- Comment
COMMENT ON COLUMN "ChatSession"."closureReason" IS 'Reason for chat closure: USER_DISCONNECTED_TIMEOUT, OPERATOR_TIMEOUT, USER_INACTIVITY_TIMEOUT, MANUAL, CONVERTED_TO_TICKET';
