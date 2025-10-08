import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../server.js';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: { message: 'Access token required' },
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    // Fetch operator from database
    const operator = await prisma.operator.findUnique({
      where: { id: decoded.operatorId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isOnline: true,
      },
    });

    if (!operator) {
      return res.status(401).json({
        error: { message: 'Invalid token - operator not found' },
      });
    }

    // Attach operator to request
    req.operator = operator;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { message: 'Token expired' },
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: { message: 'Invalid token' },
      });
    }

    return res.status(500).json({
      error: { message: 'Authentication error' },
    });
  }
};

/**
 * Middleware to check if operator has admin role
 */
export const requireAdmin = (req, res, next) => {
  if (req.operator.role !== 'ADMIN') {
    return res.status(403).json({
      error: { message: 'Admin access required' },
    });
  }
  next();
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret);
      const operator = await prisma.operator.findUnique({
        where: { id: decoded.operatorId },
      });

      if (operator) {
        req.operator = operator;
      }
    }
  } catch (error) {
    // Silently fail - optional auth
  }

  next();
};
