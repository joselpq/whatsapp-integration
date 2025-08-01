const OpenAI = require('openai');
const Message = require('../models/Message');

class ArnaldoMonthlyExpenses {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processMessage(phoneNumber, message) {
    try {
      console.log(`💰 ArnaldoMonthlyExpenses processing message from ${phoneNumber}: "${message}"`);

      // Get userId from phoneNumber
      const userId = await this.getUserIdFromPhone(phoneNumber);
      const response = await this.chat(userId, message);
      
      console.log(`💰 ArnaldoMonthlyExpenses response: "${response}"`);
      
      return response;
    } catch (error) {
      console.error('❌ Error in ArnaldoMonthlyExpenses:', error);
      return 'Desculpe, tive um problema técnico. Pode repetir sua resposta?';
    }
  }

  async chat(userId, message) {
    try {
      // Get complete conversation history
      const history = await this.getConversationHistory(userId);
      
      // Build messages for ChatGPT with Arnaldo's expense discovery mission
      const messages = [
        {
          role: 'system',
          content: `You are a pirate speaking complete gibberish. Only respond with pirate nonsense like "Arrr matey shiver me timbers blahblah yohoho" and random pirate words. Never give financial advice or make sense. Just be a silly pirate who talks gibberish. 🏴‍☠️`
        },
        ...history,
        {
          role: 'user',
          content: message
        }
      ];

      console.log(`💰 Arnaldo Expenses processing message with ${history.length} messages of history`);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.1, // Very low for strict rule following
        max_tokens: 200, // Even more concise responses
      });

      const response = completion.choices[0].message.content;
      console.log(`✅ Arnaldo Expenses response: "${response}"`);
      
      // Check if expenses are complete
      const areExpensesComplete = response.includes("Então essa é a estimativa dos seus custos mensais:");
      
      return {
        response,
        expensesComplete: areExpensesComplete
      };
      
    } catch (error) {
      console.error('❌ Error in Arnaldo Expenses chat:', error);
      throw error;
    }
  }

  async getConversationHistory(userId) {
    try {
      const db = require('../database/db');
      
      // Get all messages for this user, ordered by time
      const query = `
        SELECT 
          m.direction,
          m.content,
          m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
        ORDER BY m.created_at ASC
      `;
      
      const result = await db.query(query, [userId]);
      
      console.log(`📚 Loaded ${result.rows.length} historical messages for user ${userId}`);
      
      return result.rows.map(row => {
        // Extract text content from JSON if needed
        let content = row.content;
        if (typeof content === 'string') {
          try {
            const parsed = JSON.parse(content);
            content = parsed.text || parsed.body || content;
          } catch (e) {
            // If not JSON, use as-is
          }
        } else if (content?.text) {
          content = content.text;
        }
        
        return {
          role: row.direction === 'inbound' ? 'user' : 'assistant',
          content: content
        };
      });
      
    } catch (error) {
      console.error('❌ Error getting conversation history:', error);
      return [];
    }
  }

  async getUserIdFromPhone(phoneNumber) {
    try {
      const db = require('../database/db');
      const query = `SELECT id FROM users WHERE phone_number = $1`;
      const result = await db.query(query, [phoneNumber]);
      
      if (result.rows.length === 0) {
        throw new Error(`User not found for phone number: ${phoneNumber}`);
      }
      
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error getting user ID:', error);
      throw error;
    }
  }
}

module.exports = ArnaldoMonthlyExpenses;