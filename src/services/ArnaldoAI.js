const OpenAI = require('openai');
const ConversationMemory = require('./ConversationMemory');

class ArnaldoAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.memory = new ConversationMemory();
    
    this.systemPrompt = `You are Arnaldo, a friendly Brazilian financial advisor whose SOLE MISSION is to help users discover and define their financial goal.

CORE OBJECTIVE: Discover what the user wants to achieve financially - what, how much, by when.

Personality:
- Warm, supportive, never judgmental
- Use natural Brazilian Portuguese
- KEEP RESPONSES SHORT (max 2 sentences for simple questions, max 4 sentences for complex advice)
- Use 1-2 emojis per message maximum
- Ask ONE question at a time

YOUR ONLY JOB:
1. Understand their financial goal completely (what, how much, when)
2. Guide them to be specific if their goal is vague
3. Once goal is clear and specific, say "então seu objetivo é:" and restate it
4. Do NOT discuss income, expenses, budgets, or planning until goal is 100% clear

Context:
- Users are low-income Brazilians (classes C, D, E)
- Help them discover realistic goals for their situation

STAY FOCUSED: Only talk about GOALS. Redirect off-topic conversations back to goal discovery.`;
  }

  async processMessage(message, context) {
    try {
      // Build conversation history for context
      const messages = this.buildConversationHistory(context);
      
      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      // Get AI response
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500, // Keep responses concise
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('AI processing error:', error);
      
      // Fallback response
      return 'Oi! Tive um probleminha técnico aqui 😅 Pode repetir sua mensagem? Prometo que vou te ajudar!';
    }
  }

  buildConversationHistory(context) {
    const messages = [];
    
    // Add user profile context if available
    if (context.profile && context.profile.monthly_income) {
      messages.push({
        role: 'system',
        content: `User context: Monthly income R$${context.profile.monthly_income}, payday on day ${context.profile.payday || 'unknown'}`
      });
    }

    // Add recent conversation (last 5 messages)
    if (context.messages && context.messages.length > 0) {
      const recentMessages = context.messages.slice(-5);
      
      recentMessages.forEach(msg => {
        messages.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.content.text || msg.content
        });
      });
    }

    // Add expense summary if available
    if (context.expenses && context.expenses.todayTotal !== undefined) {
      messages.push({
        role: 'system',
        content: `Today's spending: R$${context.expenses.todayTotal.toFixed(2)}, Daily budget: R$${context.expenses.dailyBudget?.toFixed(2) || 'not set'}`
      });
    }

    return messages;
  }

  // Goal discovery focused method with full conversation context
  async processGoalDiscoveryMessage(message, userId) {
    try {
      console.log(`🎯 Processing goal discovery message for user ${userId}: "${message}"`);
      
      // Load full conversation context
      const fullContext = await this.memory.loadConversationContext(userId);
      const aiContext = this.memory.formatForAI(fullContext);
      
      // Build messages for AI with full conversation history
      const messages = [
        { role: 'system', content: this.systemPrompt }
      ];
      
      // Add conversation history for context (last 30 messages)
      if (aiContext.conversationHistory && aiContext.conversationHistory.length > 0) {
        const recentHistory = aiContext.conversationHistory.slice(-30);
        recentHistory.forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        });
      }
      
      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0].message.content;
      console.log(`✅ Goal discovery response generated for user ${userId}`);
      
      return response;
      
    } catch (error) {
      console.error('❌ Goal discovery AI error:', error);
      
      // Fallback response
      return 'Me conta mais sobre seu objetivo financeiro! Quero te ajudar a definir sua meta 😊';
    }
  }
}

module.exports = ArnaldoAI;