import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';
import multer from 'multer';
import { prisma } from '../server.js';

class UploadService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize Cloudinary with credentials from database or env
   */
  async initialize() {
    try {
      // Try to get settings from database first
      const settings = await this.getSettingsFromDatabase();

      const cloudName = settings?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = settings?.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY;
      const apiSecret = settings?.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        console.warn('⚠️  Cloudinary credentials not configured');
        this.initialized = false;
        return false;
      }

      // Configure Cloudinary
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });

      this.initialized = true;
      console.log('✅ Upload service (Cloudinary) initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Upload service:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get Cloudinary settings from database
   */
  async getSettingsFromDatabase() {
    try {
      const cloudName = await prisma.systemSettings.findUnique({
        where: { key: 'cloudinaryCloudName' },
      });
      const apiKey = await prisma.systemSettings.findUnique({
        where: { key: 'cloudinaryApiKey' },
      });
      const apiSecret = await prisma.systemSettings.findUnique({
        where: { key: 'cloudinaryApiSecret' },
      });

      return {
        cloudinaryCloudName: cloudName?.value,
        cloudinaryApiKey: apiKey?.value,
        cloudinaryApiSecret: apiSecret?.value,
      };
    } catch (error) {
      console.error('Failed to get Cloudinary settings from database:', error);
      return null;
    }
  }

  /**
   * Check if upload service is ready
   */
  isReady() {
    return this.initialized;
  }

  /**
   * P0.1: Upload file to Cloudinary
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimetype - File MIME type
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadFile(buffer, originalName, mimetype) {
    if (!this.isReady()) {
      await this.initialize();
      if (!this.isReady()) {
        throw new Error('Upload service not initialized. Please configure Cloudinary credentials.');
      }
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'lucine-chat-attachments',
          resource_type: 'auto', // Automatically detect file type
          public_id: `${Date.now()}_${originalName.replace(/\.[^/.]+$/, '')}`,
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload failed:', error);
            reject(error);
          } else {
            console.log(`✅ File uploaded: ${result.secure_url}`);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              format: result.format,
              resourceType: result.resource_type,
              bytes: result.bytes,
              width: result.width,
              height: result.height,
              originalName: originalName,
              mimetype: mimetype,
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * P0.1: Delete file from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(publicId) {
    if (!this.isReady()) {
      await this.initialize();
      if (!this.isReady()) {
        throw new Error('Upload service not initialized');
      }
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log(`🗑️  File deleted: ${publicId}`);
      return result;
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  /**
   * Get multer memory storage configuration
   */
  getMulterStorage() {
    return multer.memoryStorage();
  }

  /**
   * Get multer file filter for validation
   */
  getFileFilter() {
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
    ];

    return (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`), false);
      }
    };
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware() {
    return multer({
      storage: this.getMulterStorage(),
      fileFilter: this.getFileFilter(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    });
  }
}

// Export singleton instance
export const uploadService = new UploadService();
