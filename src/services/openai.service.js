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
 * Search knowledge base using semantic search with pgvector
 */
export async function searchKnowledgeBase(query, maxResults = 5) {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Format embedding as PostgreSQL vector string: '[0.1, 0.2, ...]'
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // Use pgvector cosine distance (<=>)  for semantic similarity
    // Returns items ordered by similarity (most similar first)
    const results = await prisma.$queryRawUnsafe(
      `
      SELECT
        id::text,
        question,
        answer,
        category,
        (1 - (embedding <=> $1::vector))::float as similarity
      FROM "KnowledgeItem"
      WHERE "isActive" = true
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      vectorString,
      maxResults
    );

    // Filter by similarity threshold (0.7 = 70% similar)
    const MIN_SIMILARITY = 0.7;
    const relevantResults = results.filter(r => r.similarity >= MIN_SIMILARITY);

    console.log(`Semantic search: found ${relevantResults.length}/${results.length} relevant results (>=${MIN_SIMILARITY} similarity)`);

    return relevantResults;
  } catch (error) {
    console.error('Semantic search error:', error);

    // Fallback to returning all active items if pgvector not available
    console.warn('Falling back to returning all active knowledge items');
    try {
      const fallbackResults = await prisma.knowledgeItem.findMany({
        where: { isActive: true },
        select: {
          id: true,
          question: true,
          answer: true,
          category: true,
        },
        take: maxResults,
      });
      return fallbackResults;
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      return [];
    }
  }
}

/**
 * Generate AI response using GPT-4 with RAG
 */
export async function generateAIResponse(userMessage, chatHistory = []) {
  try {
    // Load system prompt from database settings
    let systemPrompt = 'Sei Lucy, l\'assistente virtuale di Lucine di Natale. Rispondi in modo cortese e professionale alle domande degli utenti. Se non sei sicuro di una risposta, suggerisci di parlare con un operatore umano.';

    try {
      const promptSetting = await prisma.systemSettings.findUnique({
        where: { key: 'aiSystemPrompt' },
      });

      if (promptSetting && promptSetting.value) {
        systemPrompt = promptSetting.value;
      }
    } catch (error) {
      console.error('Error loading system prompt from database, using default:', error);
    }

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
        content: `${systemPrompt}

IMPORTANTE - Rilevamento Richieste Operatore:
- Se l'utente chiede esplicitamente di parlare con una persona umana, un operatore, assistenza umana, o supporto diretto, rispondi SOLO: "Capisco che preferisci parlare con una persona. Ti metto in contatto con un operatore!"
- NON menzionare la disponibilità degli operatori (es. "nessun operatore disponibile", "operatori offline", etc.) - il sistema gestirà automaticamente questo aspetto
- NON suggerire ticket o altre azioni - il sistema mostrerà le opzioni appropriate all'utente
- Se l'utente esprime frustrazione o insoddisfazione, considera di suggerire un operatore
- Se non hai informazioni sufficienti per rispondere con certezza, ammettilo e suggerisci un operatore

Usa la knowledge base se disponibile per dare risposte precise.
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

    // Semantic detection: check if AI explicitly mentions connecting to operator
    const operatorMentioned = /metto in contatto|parla con un operatore|contattare un operatore|assistenza umana|operatore ti aiuterà/i.test(aiMessage);

    return {
      message: aiMessage,
      confidence: confidence,
      hasKnowledgeBaseResults: kbResults.length > 0,
      suggestOperator: confidence < config.kb.confidenceThreshold || operatorMentioned,
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
