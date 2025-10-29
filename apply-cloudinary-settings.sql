-- Apply Cloudinary settings to database
-- Run this if you don't see Cloudinary fields in Dashboard Settings → Integrazioni

-- Insert Cloudinary settings with your credentials
INSERT INTO "SystemSettings" (id, key, value, description, category, "updatedAt")
VALUES
  (gen_random_uuid(), 'cloudinaryCloudName', 'dja2b7cyw', 'Cloudinary Cloud Name for file storage', 'integrations', NOW()),
  (gen_random_uuid(), 'cloudinaryApiKey', '778117516175176', 'Cloudinary API Key', 'integrations', NOW()),
  (gen_random_uuid(), 'cloudinaryApiSecret', 'stZ374OjiJpjInPXakGtZ85rCm0', 'Cloudinary API Secret', 'integrations', NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  "updatedAt" = NOW();
