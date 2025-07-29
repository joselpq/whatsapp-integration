/**
 * ConversationPhase - Base class for all conversation phases
 * Each phase represents a distinct stage in the conversation flow
 */
class ConversationPhase {
  /**
   * @param {object} messagingService - WhatsApp messaging service instance
   * @param {object} stateDetector - Conversation state detector instance
   */
  constructor(messagingService, stateDetector) {
    if (new.target === ConversationPhase) {
      throw new Error('ConversationPhase is an abstract class and cannot be instantiated directly');
    }
    
    this.messagingService = messagingService;
    this.stateDetector = stateDetector;
  }
  
  /**
   * Process an incoming message for this phase
   * @param {object} messageInfo - Message information
   * @returns {Promise<object>} Processing result with phase info and transition details
   */
  async process(messageInfo) {
    throw new Error('process() must be implemented by subclass');
  }
  
  /**
   * Get the phase name
   * @returns {string} Phase identifier
   */
  getName() {
    throw new Error('getName() must be implemented by subclass');
  }
  
  /**
   * Helper method to check if response is affirmative
   * @param {string} message - User message
   * @returns {boolean} True if affirmative response
   */
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
}

module.exports = ConversationPhase;