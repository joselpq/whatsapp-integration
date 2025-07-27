const ArnaldoGoalDiscovery = require('./ArnaldoGoalDiscovery');
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
    this.arnaldoAI = new ArnaldoGoalDiscovery();
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
      
      if (isFirstMessage) {
        // Send welcome message
        await this._sendWelcomeMessage(phoneNumber);
        return { 
          processed: true, 
          action: 'sent_welcome',
          sentMessage: true 
        };
      }

      // Use Arnaldo AI for goal discovery
      const aiResponse = await this.arnaldoAI.chat(content, userId);
      
      // Send the AI response
      await this.messagingService.sendMessage(phoneNumber, aiResponse.message);
      
      // Log if goal was completed
      if (aiResponse.goalComplete) {
        console.log(`🎯 Goal discovery complete for user ${userId}!`);
        // Could trigger additional actions here like updating user profile
        // or notifying other services
      }
      
      return {
        processed: true,
        action: 'sent_ai_response',
        goalComplete: aiResponse.goalComplete,
        sentMessage: true
      };

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
      return parseInt(result.rows[0].count) === 0;
    } catch (error) {
      console.error('Error checking first message:', error);
      return true; // Default to showing welcome if unsure
    }
  }

  async _sendWelcomeMessage(phoneNumber) {
    const welcomeMessage = `Oi! Sou o Arnaldo, seu consultor financeiro pessoal! 👋

Vou te ajudar a definir e alcançar seu principal objetivo financeiro.

Me conta: o que você mais quer conquistar? 

Pode ser qualquer coisa:
💰 Criar uma reserva de emergência
🏠 Comprar casa própria
🚗 Trocar de carro
📱 Comprar um celular novo
✈️ Fazer aquela viagem dos sonhos
💳 Quitar as dívidas

Fala aí, qual é seu sonho? 😊`;

    await this.messagingService.sendMessage(phoneNumber, welcomeMessage);
  }
}

module.exports = ArnaldoAgent;