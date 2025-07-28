const ArnaldoGoalDiscovery = require('./ArnaldoGoalDiscovery');
const ArnaldoMonthlyExpenses = require('./ArnaldoMonthlyExpenses');
const WhatsAppMessagingService = require('./WhatsAppMessagingService');

/**
 * Arnaldo Agent - Handles all business logic for the financial assistant
 * Responsibilities:
 * - Decide what messages to send
 * - Handle conversation flow
 * - Manage user state
 * - Call AI for responses
 */
class ArnaldoAgent {
  constructor() {
    this.goalDiscovery = new ArnaldoGoalDiscovery();
    this.monthlyExpenses = new ArnaldoMonthlyExpenses();
    this.messagingService = new WhatsAppMessagingService();
  }

  /**
   * Process an incoming message from a user
   * @param {object} messageInfo - Message info from WhatsApp webhook
   * @returns {object} Processing result
   */
  async processIncomingMessage(messageInfo) {
    try {
      const { userId, phoneNumber, content, messageType } = messageInfo;
      
      // Only process text messages for now
      if (messageType !== 'text' || !content) {
        console.log(`🤖 Ignoring non-text message type: ${messageType}`);
        return { processed: false, reason: 'non-text message' };
      }

      console.log(`🤖 Arnaldo processing message from user ${userId}: "${content}"`);

      // Check if this is the user's first message
      const isFirstMessage = await this._isFirstMessage(userId);
      
      console.log(`🔍 User ${userId} first message check: ${isFirstMessage}`);
      
      if (isFirstMessage) {
        // Send welcome message
        console.log(`👋 Sending welcome message to ${phoneNumber}`);
        await this._sendWelcomeMessage(phoneNumber);
        return { 
          processed: true, 
          action: 'sent_welcome',
          sentMessage: true 
        };
      }

      // Get conversation state to check what phase we're in
      const conversationState = await this._getConversationState(userId);
      
      // Phase 1: Goal Discovery
      if (!conversationState.goalComplete) {
        // Check if last message was goal confirmation question
        const lastMessage = await this._getLastOutboundMessage(userId);
        const askedGoalConfirmation = lastMessage && lastMessage.includes('Podemos considerar este objetivo e seguir para a próxima etapa?');
        
        if (askedGoalConfirmation && this._isAffirmativeResponse(content)) {
          // User confirmed goal - transition to expenses
          console.log(`✅ User confirmed goal with "${content}", transitioning to expenses`);
          await this._sendTransitionMessage(phoneNumber);
          await this._markGoalComplete(userId);
          
          return {
            processed: true,
            action: 'goal_confirmed_transitioning',
            goalComplete: true,
            sentMessage: true
          };
        } else {
          // Still in goal discovery - route to AI
          console.log(`🎯 Routing to Goal Discovery for user ${userId}`);
          const goalResponse = await this.goalDiscovery.chat(content, userId);
          await this.messagingService.sendMessage(phoneNumber, goalResponse.message);
          
          return {
            processed: true,
            action: 'sent_goal_discovery_response',
            goalComplete: false,
            sentMessage: true
          };
        }
      } 
      // Phase 2: Monthly Expenses Discovery
      else if (!conversationState.expensesComplete) {
        console.log(`💰 Routing to Monthly Expenses for user ${userId}`);
        const expenseResponse = await this.monthlyExpenses.processMessage(phoneNumber, content);
        await this.messagingService.sendMessage(phoneNumber, expenseResponse.response);
        
        // Check if expenses are complete
        if (expenseResponse.expensesComplete) {
          console.log(`✅ Monthly expenses discovery complete for user ${userId}!`);
          await this._markExpensesComplete(userId);
        }
        
        return {
          processed: true,
          action: 'sent_expenses_response',
          expensesComplete: expenseResponse.expensesComplete,
          sentMessage: true
        };
      } 
      // Phase 3: Both complete - conversation finished
      else {
        // Both goal and expenses are complete - conversation is finished
        console.log(`🏁 Conversation complete for user ${userId} - not responding`);
        return {
          processed: false,
          reason: 'conversation_complete',
          sentMessage: false
        };
      }

    } catch (error) {
      console.error('❌ Error processing message:', error);
      
      // Try to send error message to user
      try {
        await this.messagingService.sendMessage(
          messageInfo.phoneNumber, 
          'Ops! Tive um probleminha técnico. Pode repetir sua mensagem? 🤔'
        );
      } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError);
      }
      
      return {
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Send a message to a user (for proactive messaging)
   * @param {string} phoneNumber - User's phone number
   * @param {string} message - Message to send
   * @param {object} options - Additional options
   * @returns {object} Send result
   */
  async sendMessage(phoneNumber, message, options = {}) {
    try {
      return await this.messagingService.sendMessage(phoneNumber, message, options);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get conversation status for a user
   * @param {string} phoneNumber - User's phone number
   * @returns {object} Conversation status
   */
  async getConversationStatus(phoneNumber) {
    return await this.messagingService.getConversationStatus(phoneNumber);
  }

  // Private methods

  async _isFirstMessage(userId) {
    try {
      // Check if user has any previous outbound messages from Arnaldo
      const db = require('../database/db');
      const query = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 AND m.direction = 'outbound'
      `;
      const result = await db.query(query, [userId]);
      const messageCount = parseInt(result.rows[0].count);
      
      console.log(`📊 User ${userId} has ${messageCount} previous outbound messages`);
      
      // Also check if user was recently created (within last 5 minutes) as backup
      const userQuery = `
        SELECT created_at FROM users WHERE id = $1
      `;
      const userResult = await db.query(userQuery, [userId]);
      const createdAt = new Date(userResult.rows[0].created_at);
      const now = new Date();
      const minutesSinceCreation = (now - createdAt) / (1000 * 60);
      
      console.log(`⏰ User ${userId} created ${minutesSinceCreation.toFixed(1)} minutes ago`);
      
      const isFirst = messageCount === 0;
      console.log(`✅ User ${userId} is first message: ${isFirst}`);
      
      return isFirst;
    } catch (error) {
      console.error('Error checking first message:', error);
      return true; // Default to showing welcome if unsure
    }
  }

  async _sendWelcomeMessage(phoneNumber) {
    const welcomeMessage = `Oi! Sou o Arnaldo, seu consultor financeiro pessoal! 👋

Vou te ajudar a organizar suas finanças e realizar seus sonhos.

Me conta: qual é seu MAIOR objetivo financeiro agora?

Pode ser qualquer coisa:
💰 Criar reserva de emergência
🏠 Comprar casa, carro, celular...
💳 Quitar dívidas
💡 Economizar mais dinheiro
🎓 Fazer curso, viagem...
🤷 Não sei bem ainda

Me fala com suas palavras!`;

    await this.messagingService.sendMessage(phoneNumber, welcomeMessage);
  }

  async _sendTransitionMessage(phoneNumber) {
    const transitionMessage = `Perfeito! Agora vamos entender seus gastos mensais para criar um plano de economia eficiente. 📊

Vamos começar: quanto você gasta por mês com moradia (aluguel, financiamento, condomínio)?`;

    await this.messagingService.sendMessage(phoneNumber, transitionMessage);
  }

  async _getConversationState(userId) {
    try {
      const db = require('../database/db');
      
      // Check if we sent the transition message (indicates goal is complete)
      const goalCompleteQuery = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 
        AND m.direction = 'outbound' 
        AND m.content LIKE '%Perfeito! Agora vamos entender seus gastos mensais%'
      `;
      const goalResult = await db.query(goalCompleteQuery, [userId]);
      const goalComplete = parseInt(goalResult.rows[0].count) > 0;
      
      // Check if expenses discovery is complete
      const expensesCompleteQuery = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 
        AND m.direction = 'outbound' 
        AND m.content LIKE '%então essa é a estimativa dos seus custos mensais:%'
      `;
      const expensesResult = await db.query(expensesCompleteQuery, [userId]);
      const expensesComplete = parseInt(expensesResult.rows[0].count) > 0;
      
      console.log(`📊 User ${userId} conversation state: goal=${goalComplete}, expenses=${expensesComplete}`);
      
      return {
        goalComplete,
        expensesComplete
      };
    } catch (error) {
      console.error('Error getting conversation state:', error);
      return {
        goalComplete: false,
        expensesComplete: false
      };
    }
  }

  async _getLastOutboundMessage(userId) {
    try {
      const db = require('../database/db');
      const query = `
        SELECT m.content 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 AND m.direction = 'outbound' 
        ORDER BY m.created_at DESC 
        LIMIT 1
      `;
      const result = await db.query(query, [userId]);
      return result.rows.length > 0 ? result.rows[0].content : null;
    } catch (error) {
      console.error('Error getting last outbound message:', error);
      return null;
    }
  }

  _isAffirmativeResponse(message) {
    const positive = ['sim', 'pode', 'vamos', 'ok', 'certo', 'perfeito', 'beleza', 'ótimo', 'claro', 'com certeza'];
    const negative = ['não', 'nao', 'nunca', 'jamais', 'negativo'];
    const lower = message.toLowerCase();
    
    const hasPositive = positive.some(word => lower.includes(word));
    const hasNegative = negative.some(word => lower.includes(word));
    
    const isAffirmative = hasPositive && !hasNegative;
    console.log(`🤔 Checking affirmative for "${message}": positive=${hasPositive}, negative=${hasNegative}, result=${isAffirmative}`);
    
    return isAffirmative;
  }

  async _markGoalComplete(userId) {
    try {
      // We can track this in a simple way - the presence of transition message indicates goal is complete
      console.log(`📌 Marking goal as complete for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error marking goal complete:', error);
      return false;
    }
  }

  async _markExpensesComplete(userId) {
    try {
      // Similar simple tracking
      console.log(`📌 Marking expenses as complete for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error marking expenses complete:', error);
      return false;
    }
  }
}

module.exports = ArnaldoAgent;