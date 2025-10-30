import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../server.js';

/**
 * Login operator
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: { message: 'Email and password are required' },
      });
    }

    // Find operator
    const operator = await prisma.operator.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        isOnline: true,
        isAvailable: true,
      },
    });

    if (!operator) {
      return res.status(401).json({
        error: { message: 'Invalid credentials' },
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, operator.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: { message: 'Invalid credentials' },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        operatorId: operator.id,
        email: operator.email,
        role: operator.role,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    // Update last seen and set available (isOnline removed - not used)
    const updated = await prisma.operator.update({
      where: { id: operator.id },
      data: {
        isAvailable: true,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        isAvailable: true,
      },
    });

    console.log('🔐 LOGIN - Updated operator status:', JSON.stringify(updated, null, 2));

    // Remove password from response
    const { passwordHash, ...operatorData } = operator;

    res.json({
      success: true,
      data: {
        token,
        operator: operatorData,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get current operator info
 * GET /api/auth/me
 */
export const getCurrentOperator = async (req, res) => {
  try {
    const operator = await prisma.operator.findUnique({
      where: { id: req.operator.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isOnline: true,
        isAvailable: true,
        whatsappNumber: true,
        notificationPreferences: true,
        totalChatsHandled: true,
        totalTicketsHandled: true,
        averageRating: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!operator) {
      return res.status(404).json({
        error: { message: 'Operator not found' },
      });
    }

    res.json({
      success: true,
      data: operator,
    });
  } catch (error) {
    console.error('Get current operator error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Logout operator
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  try {
    // Set operator offline and unavailable
    await prisma.operator.update({
      where: { id: req.operator.id },
      data: {
        isOnline: false,
        isAvailable: false,
        lastSeenAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Refresh JWT token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res) => {
  try {
    // Token already verified by middleware (req.operator exists)
    const operator = await prisma.operator.findUnique({
      where: { id: req.operator.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isOnline: true,
        isAvailable: true,
      },
    });

    if (!operator) {
      return res.status(404).json({
        error: { message: 'Operator not found' },
      });
    }

    // Generate new JWT token
    const token = jwt.sign(
      {
        operatorId: operator.id,
        email: operator.email,
        role: operator.role,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    // Update last seen
    await prisma.operator.update({
      where: { id: operator.id },
      data: { lastSeenAt: new Date() },
    });

    res.json({
      success: true,
      data: {
        token,
        expiresIn: config.jwtExpiresIn,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Verify token (for auto-login)
 * POST /api/auth/verify
 */
export const verifyToken = async (req, res) => {
  try {
    // Token already verified by middleware
    // Just return operator data
    res.json({
      success: true,
      data: req.operator,
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
