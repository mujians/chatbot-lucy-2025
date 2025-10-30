import { prisma } from '../server.js';
import { io } from '../server.js';
import bcrypt from 'bcryptjs';
import { emailService } from '../services/email.service.js';

/**
 * Toggle operator availability (available to receive chats)
 * POST /api/operators/me/toggle-availability
 */
export const toggleAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    const operator = await prisma.operator.update({
      where: { id: req.operator.id },
      data: {
        isAvailable: isAvailable,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        isOnline: true,
        isAvailable: true,
      },
    });

    // Broadcast operator availability change via WebSocket
    io.to('dashboard').emit('operator_availability_changed', {
      operatorId: operator.id,
      operatorName: operator.name,
      isOnline: operator.isOnline,
      isAvailable: operator.isAvailable,
    });

    res.json({
      success: true,
      data: operator,
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Update notification preferences
 * PUT /api/operators/me/notification-preferences
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;

    const operator = await prisma.operator.update({
      where: { id: req.operator.id },
      data: {
        notificationPreferences: preferences,
        whatsappNumber: preferences.whatsapp?.number || null,
      },
      select: {
        id: true,
        notificationPreferences: true,
        whatsappNumber: true,
      },
    });

    res.json({
      success: true,
      data: operator,
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get all operators (for admin)
 * GET /api/operators
 */
export const getOperators = async (req, res) => {
  try {
    const operators = await prisma.operator.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isOnline: true,
        isAvailable: true,
        totalChatsHandled: true,
        totalTicketsHandled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: operators,
    });
  } catch (error) {
    console.error('Get operators error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get online and available operators (for chat assignment)
 * GET /api/operators/online
 */
export const getOnlineOperators = async (req, res) => {
  try {
    // Debug: get ALL operators to see what's in DB
    const allOperators = await prisma.operator.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isOnline: true,
        isAvailable: true,
      },
    });
    console.log('🔍 ALL OPERATORS IN DB:', JSON.stringify(allOperators, null, 2));

    const operators = await prisma.operator.findMany({
      where: {
        isOnline: true,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isAvailable: true,
        totalChatsHandled: true,
      },
      orderBy: { totalChatsHandled: 'asc' }, // Least busy first
    });

    console.log('✅ FOUND AVAILABLE OPERATORS:', operators.length);
    console.log('📊 OPERATORS DATA:', JSON.stringify(operators, null, 2));

    res.json({
      success: true,
      data: operators,
      count: operators.length,
    });
  } catch (error) {
    console.error('❌ Get online operators error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Create new operator (admin only)
 * POST /api/operators
 */
export const createOperator = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: { message: 'Email, password, and name are required' },
      });
    }

    // Check if email already exists
    const existing = await prisma.operator.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(400).json({
        error: { message: 'Email already exists' },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create operator
    const operator = await prisma.operator.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || 'OPERATOR',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Send welcome email with login credentials
    const dashboardUrl = process.env.DASHBOARD_URL || 'https://dashboard.lucine.it';
    await emailService.sendEmail({
      to: email,
      subject: 'Benvenuto nel Team Lucine di Natale',
      text: `Ciao ${name}!\n\nSei stato aggiunto come ${role === 'ADMIN' ? 'amministratore' : 'operatore'} del sistema Lucine Chatbot.\n\nCredenziali di accesso:\nEmail: ${email}\nPassword: ${password}\n\nAccedi qui: ${dashboardUrl}\n\nCambia la tua password dopo il primo accesso.\n\nBenvenuto nel team!`
    });

    res.json({
      success: true,
      data: operator,
    });
  } catch (error) {
    console.error('Create operator error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Update operator (admin only)
 * PUT /api/operators/:operatorId
 */
export const updateOperator = async (req, res) => {
  try {
    const { operatorId } = req.params;
    const { email, password, name, role } = req.body;

    const updateData = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const operator = await prisma.operator.update({
      where: { id: operatorId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: operator,
    });
  } catch (error) {
    console.error('Update operator error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Delete operator (admin only)
 * DELETE /api/operators/:operatorId
 */
export const deleteOperator = async (req, res) => {
  try {
    const { operatorId } = req.params;

    // Prevent deleting self
    if (operatorId === req.operator.id) {
      return res.status(400).json({
        error: { message: 'Cannot delete yourself' },
      });
    }

    await prisma.operator.delete({
      where: { id: operatorId },
    });

    res.json({
      success: true,
      message: 'Operator deleted successfully',
    });
  } catch (error) {
    console.error('Delete operator error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
