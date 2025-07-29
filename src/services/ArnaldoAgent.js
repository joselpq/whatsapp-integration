const WhatsAppMessagingService = require('./WhatsAppMessagingService');
const ConversationOrchestrator = require('../orchestration/ConversationOrchestrator');

/**
 * Arnaldo Agent - Financial assistant orchestration facade
 * Delegates conversation flow to ConversationOrchestrator
 */
class ArnaldoAgent {
  constructor() {
    this.messagingService = new WhatsAppMessagingService();
    this.orchestrator = new ConversationOrchestrator(this.messagingService);
    console.log('🤖 ArnaldoAgent initialized with ConversationOrchestrator');
  }

  /**
   * Process an incoming message from a user
   * @param {object} messageInfo - Message info from WhatsApp webhook
   * @returns {object} Processing result
   */
  async processIncomingMessage(messageInfo) {
    console.log(`🤖 ArnaldoAgent delegating to orchestrator for user ${messageInfo.userId}`);
    return await this.orchestrator.processMessage(messageInfo);
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
    return await this.orchestrator.getConversationStatus(phoneNumber);
  }
}

module.exports = ArnaldoAgent;