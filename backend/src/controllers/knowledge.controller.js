import { prisma } from '../server.js';
import { generateEmbedding } from '../services/openai.service.js';

/**
 * Get all knowledge base items
 * GET /api/knowledge
 */
export const getKnowledgeItems = async (req, res) => {
  try {
    const { category, isActive, search } = req.query;

    const where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.knowledgeItem.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Get knowledge items error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get knowledge item by ID
 * GET /api/knowledge/:itemId
 */
export const getKnowledgeItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({
        error: { message: 'Knowledge item not found' },
      });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Get knowledge item error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Create knowledge base item
 * POST /api/knowledge
 */
export const createKnowledgeItem = async (req, res) => {
  try {
    const { question, answer, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        error: { message: 'Question and answer are required' },
      });
    }

    // Generate embedding (async, don't wait for it)
    let embedding = null;
    try {
      embedding = await generateEmbedding(question + ' ' + answer);
    } catch (error) {
      console.warn('Failed to generate embedding:', error);
    }

    const item = await prisma.knowledgeItem.create({
      data: {
        question,
        answer,
        category: category || 'ALTRO',
        isActive: true,
        createdBy: req.operator.id,
        // Note: embedding would be set here if pgvector is configured
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Create knowledge item error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Update knowledge base item
 * PUT /api/knowledge/:itemId
 */
export const updateKnowledgeItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { question, answer, category, isActive } = req.body;

    const updateData = {};
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Re-generate embedding if question or answer changed
    if (question || answer) {
      try {
        const item = await prisma.knowledgeItem.findUnique({
          where: { id: itemId },
        });
        const newText =
          (question || item.question) + ' ' + (answer || item.answer);
        const embedding = await generateEmbedding(newText);
        // Note: would update embedding here if pgvector configured
      } catch (error) {
        console.warn('Failed to regenerate embedding:', error);
      }
    }

    const item = await prisma.knowledgeItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Update knowledge item error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Delete knowledge base item
 * DELETE /api/knowledge/:itemId
 */
export const deleteKnowledgeItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    await prisma.knowledgeItem.delete({
      where: { id: itemId },
    });

    res.json({
      success: true,
      message: 'Knowledge item deleted',
    });
  } catch (error) {
    console.error('Delete knowledge item error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Toggle knowledge item active status
 * PATCH /api/knowledge/:itemId/toggle
 */
export const toggleKnowledgeItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({
        error: { message: 'Knowledge item not found' },
      });
    }

    const updated = await prisma.knowledgeItem.update({
      where: { id: itemId },
      data: { isActive: !item.isActive },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle knowledge item error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Bulk import knowledge items from CSV
 * POST /api/knowledge/bulk
 */
export const bulkImportKnowledge = async (req, res) => {
  try {
    const { items } = req.body; // Array of {question, answer, category}

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: { message: 'Items array is required' },
      });
    }

    const results = [];

    for (const item of items) {
      if (!item.question || !item.answer) {
        continue; // Skip invalid items
      }

      try {
        const created = await prisma.knowledgeItem.create({
          data: {
            question: item.question,
            answer: item.answer,
            category: item.category || 'ALTRO',
            isActive: true,
            createdBy: req.operator.id,
          },
        });
        results.push(created);
      } catch (error) {
        console.error(`Failed to create item: ${item.question}`, error);
      }
    }

    res.json({
      success: true,
      data: {
        imported: results.length,
        total: items.length,
        items: results,
      },
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Regenerate embeddings for all knowledge items
 * POST /api/knowledge/regenerate-embeddings
 */
export const regenerateAllEmbeddings = async (req, res) => {
  try {
    // Get all knowledge items
    const items = await prisma.knowledgeItem.findMany({
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });

    if (items.length === 0) {
      return res.json({
        success: true,
        data: {
          processed: 0,
          total: 0,
          message: 'No knowledge items found',
        },
      });
    }

    // Process embeddings asynchronously
    let processed = 0;
    const errors = [];

    for (const item of items) {
      try {
        const text = `${item.question}\n${item.answer}`;
        const embedding = await generateEmbedding(text);

        await prisma.knowledgeItem.update({
          where: { id: item.id },
          data: { embedding },
        });

        processed++;
      } catch (error) {
        console.error(`Failed to generate embedding for item ${item.id}:`, error);
        errors.push({ id: item.id, question: item.question });
      }
    }

    res.json({
      success: true,
      data: {
        processed,
        total: items.length,
        errors: errors.length,
        failedItems: errors,
        message: `Successfully regenerated ${processed} of ${items.length} embeddings`,
      },
    });
  } catch (error) {
    console.error('Regenerate embeddings error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
