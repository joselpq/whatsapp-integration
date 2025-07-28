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

      // Check conversation state to determine which AI service to use
      const conversationState = await this._getConversationState(userId);
      
      if (!conversationState.goalComplete) {
        // Route to Goal Discovery
        console.log(`🎯 Routing to Goal Discovery for user ${userId}`);
        const goalResponse = await this.goalDiscovery.chat(content, userId);
        
        // Check if user confirmed goal completion
        if (goalResponse.goalComplete || this._isGoalConfirmation(content)) {
          // Goal is now complete - send transition message
          await this.messagingService.sendMessage(phoneNumber, goalResponse.response);
          await this._sendTransitionMessage(phoneNumber);
          
          return {
            processed: true,
            action: 'goal_completed_with_transition',
            goalComplete: true,
            sentMessage: true
          };
        } else {
          // Still in goal discovery phase
          await this.messagingService.sendMessage(phoneNumber, goalResponse.response);
          
          return {
            processed: true,
            action: 'sent_goal_discovery_response',
            goalComplete: false,
            sentMessage: true
          };
        }
      } else if (!conversationState.expensesComplete) {
        // Route to Monthly Expenses Discovery
        console.log(`💰 Routing to Monthly Expenses for user ${userId}`);
        const expenseResponse = await this.monthlyExpenses.processMessage(phoneNumber, content);
        
        // Send the AI response
        await this.messagingService.sendMessage(phoneNumber, expenseResponse.response);
        
        if (expenseResponse.expensesComplete) {
          console.log(`✅ Monthly expenses discovery complete for user ${userId}!`);
        }
        
        return {
          processed: true,
          action: 'sent_expenses_response',
          expensesComplete: expenseResponse.expensesComplete,
          sentMessage: true
        };
      } else {
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
      
      // Check if goal discovery is complete by looking for goal completion message
      const goalCompleteQuery = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 
        AND m.direction = 'outbound' 
        AND m.content LIKE '%Então podemos considerar que seu objetivo é:%'
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

  _isGoalConfirmation(message) {
    // Check if user confirmed the goal with positive responses
    const confirmationWords = ['sim', 'yes', 'pode', 'vamos', 'perfeito', 'certo', 'ok', 'beleza', 'ótimo'];
    const lowerMessage = message.toLowerCase();
    return confirmationWords.some(word => lowerMessage.includes(word));
  }
}

module.exports = ArnaldoAgent;