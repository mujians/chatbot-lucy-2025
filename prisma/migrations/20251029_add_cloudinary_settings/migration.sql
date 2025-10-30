-- P0.1: Add Cloudinary configuration settings
-- These settings enable file upload functionality with Cloudinary cloud storage

-- IMPORTANT: After running this migration, you MUST configure Cloudinary credentials
-- either via Environment Variables or Dashboard Settings UI:
--
-- Method 1: Environment Variables (Recommended for production)
-- Set these in your .env or Render.com environment:
--   CLOUDINARY_CLOUD_NAME=your-cloud-name
--   CLOUDINARY_API_KEY=your-api-key
--   CLOUDINARY_API_SECRET=your-api-secret
--
-- Method 2: Dashboard Settings UI
-- Go to Dashboard → Settings → Integrazioni
-- Fill in the Cloudinary fields and save

-- Create placeholder settings (will be populated via ENV or Dashboard)
INSERT INTO "SystemSettings" (id, key, value, description, category, "updatedAt")
VALUES
  (gen_random_uuid(), 'cloudinaryCloudName', '', 'Cloudinary Cloud Name for file storage', 'integrations', NOW()),
  (gen_random_uuid(), 'cloudinaryApiKey', '', 'Cloudinary API Key', 'integrations', NOW()),
  (gen_random_uuid(), 'cloudinaryApiSecret', '', 'Cloudinary API Secret', 'integrations', NOW())
ON CONFLICT (key) DO NOTHING;
