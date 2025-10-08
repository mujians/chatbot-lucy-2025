import OpenAI from 'openai';
import { config } from '../config/index.js';
import { prisma } from '../server.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generate embedding for text (for knowledge base search)
 */
export async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Generate embedding error:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Search knowledge base using semantic search
 */
export async function searchKnowledgeBase(query, maxResults = 5) {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // For now, use simple text search
    // TODO: Implement pgvector similarity search when ready
    const results = await prisma.knowledgeItem.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: query, mode: 'insensitive' } },
          { answer: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
      },
      take: maxResults,
    });

    return results;
  } catch (error) {
    console.error('Search knowledge base error:', error);
    return [];
  }
}

/**
 * Generate AI response using GPT-4 with RAG
 */
export async function generateAIResponse(userMessage, chatHistory = []) {
  try {
    // Search knowledge base
    const kbResults = await searchKnowledgeBase(userMessage, 3);

    // Build context from knowledge base
    let context = '';
    if (kbResults.length > 0) {
      context = 'Informazioni disponibili:\n\n';
      kbResults.forEach((item, index) => {
        context += `${index + 1}. Domanda: ${item.question}\n`;
        context += `   Risposta: ${item.answer}\n\n`;
      });
    }

    // Build messages for ChatGPT
    const messages = [
      {
        role: 'system',
        content: `Sei Lucy, l'assistente virtuale delle Lucine di Natale.
Sei gentile, professionale e cordiale.
Rispondi in italiano in modo conciso e chiaro.
Se hai informazioni dalla knowledge base, usale per rispondere.
Se non sei sicuro, suggerisci di parlare con un operatore umano.

${context ? `\n${context}` : ''}`,
      },
    ];

    // Add chat history (last 5 messages for context)
    const recentHistory = chatHistory.slice(-5);
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: messages,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
    });

    const aiMessage = response.choices[0].message.content;
    const confidence = calculateConfidence(kbResults.length, response.choices[0].finish_reason);

    return {
      message: aiMessage,
      confidence: confidence,
      hasKnowledgeBaseResults: kbResults.length > 0,
      suggestOperator: confidence < config.kb.confidenceThreshold,
    };
  } catch (error) {
    console.error('Generate AI response error:', error);

    // Fallback response
    return {
      message: 'Mi dispiace, sto avendo problemi tecnici. Vuoi parlare con un operatore?',
      confidence: 0,
      hasKnowledgeBaseResults: false,
      suggestOperator: true,
    };
  }
}

/**
 * Calculate confidence score based on KB results and completion
 */
function calculateConfidence(kbResultsCount, finishReason) {
  let confidence = 0.5; // Base confidence

  // Higher confidence if we have KB results
  if (kbResultsCount > 0) {
    confidence += 0.3;
  }

  // Higher confidence if completion was successful
  if (finishReason === 'stop') {
    confidence += 0.2;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Generate embeddings for all knowledge base items
 */
export async function generateAllEmbeddings() {
  try {
    const items = await prisma.knowledgeItem.findMany({
      where: { embedding: null },
    });

    console.log(`Generating embeddings for ${items.length} items...`);

    for (const item of items) {
      const embedding = await generateEmbedding(item.question + ' ' + item.answer);

      // Note: pgvector embedding update would be done here
      // For now, we skip the actual update
      console.log(`Generated embedding for item: ${item.id}`);
    }

    console.log('All embeddings generated!');
  } catch (error) {
    console.error('Generate all embeddings error:', error);
    throw error;
  }
}
