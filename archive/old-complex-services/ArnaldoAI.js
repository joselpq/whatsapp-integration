const OpenAI = require('openai');

class ArnaldoAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async chat(message, userId) {
    try {
      // Get conversation history
      const history = await this.getConversationHistory(userId);
      
      // Build messages for ChatGPT
      const messages = [
        {
          role: 'system',
          content: `You are Arnaldo, a friendly Brazilian financial advisor whose SOLE MISSION is to help users discover and define their financial goal.

CORE OBJECTIVE: Discover what the user wants to achieve financially - what, how much, by when.

YOUR ONLY JOB:
1. Understand their financial goal completely (what, how much, when)
2. Guide them to be specific if their goal is vague
3. Once goal is clear and specific, say "então seu objetivo é:" and restate it concisely
4. Do NOT discuss income, expenses, budgets, or planning until goal is 100% clear

WHEN TO SAY "então seu objetivo é:":
- ONLY when you have ALL THREE: what (item/purpose), how much (amount), and when (timeline)
- Example: "então seu objetivo é: economizar R$ 12.000 para uma viagem ao Japão até julho de 2026!"
- If missing any detail, keep asking questions

CRITICAL RULES:
- ALWAYS maintain conversation context - if user already mentioned a goal (like "viagem ao Japão"), NEVER forget it
- When user says "não sei" about details, help them estimate (e.g., typical trip costs)
- When user is confused ("como assim?"), clarify your question, don't start over
- NEVER give generic "what's your goal?" responses if a goal was already mentioned

Personality:
- Warm, supportive, never judgmental
- Use natural Brazilian Portuguese
- KEEP RESPONSES SHORT (max 2 sentences for simple questions, max 4 sentences for complex advice)
- Use 1-2 emojis per message maximum
- Ask ONE question at a time

Context:
- Users are low-income Brazilians (classes C, D, E)
- Help them discover realistic goals for their situation

STAY FOCUSED: Only talk about GOALS. Redirect off-topic conversations back to goal discovery.`
        },
        ...history,
        {
          role: 'user',
          content: message
        }
      ];

      console.log(`🤖 Sending to ChatGPT with ${history.length} messages of history`);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0].message.content;
      console.log(`✅ ChatGPT response: "${response}"`);
      
      return response;
      
    } catch (error) {
      console.error('❌ ChatGPT error:', error);
      return 'Me conta mais sobre seu objetivo financeiro! Quero te ajudar a definir sua meta 😊';
    }
  }

  async getConversationHistory(userId) {
    try {
      const db = require('../database/db');
      const query = `
        SELECT 
          m.direction,
          m.content,
          m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
        ORDER BY m.created_at ASC
        LIMIT 50
      `;
      
      const result = await db.query(query, [userId]);
      
      return result.rows.map(row => {
        // Parse JSON content if needed
        let content = row.content;
        try {
          const parsed = JSON.parse(row.content);
          content = parsed.text || parsed.body || content;
        } catch (e) {
          // Use as-is if not JSON
        }
        
        return {
          role: row.direction === 'inbound' ? 'user' : 'assistant',
          content: content
        };
      });
      
    } catch (error) {
      console.error('Error loading conversation history:', error);
      return [];
    }
  }
}

module.exports = ArnaldoAI;