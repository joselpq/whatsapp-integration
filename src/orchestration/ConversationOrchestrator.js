const ConversationStateDetector = require('./ConversationStateDetector');
const WelcomePhase = require('./phases/WelcomePhase');
const GoalDiscoveryPhase = require('./phases/GoalDiscoveryPhase');
const MonthlyExpensesPhase = require('./phases/MonthlyExpensesPhase');
const CompletePhase = require('./phases/CompletePhase');

/**
 * ConversationOrchestrator - Central orchestration engine for conversation flow
 * Manages phase detection, routing, and transitions
 */
class ConversationOrchestrator {
  constructor(messagingService) {
    this.messagingService = messagingService;
    this.stateDetector = new ConversationStateDetector();
    
    // Initialize all conversation phases
    this.phases = new Map([
      ['welcome', new WelcomePhase(messagingService, this.stateDetector)],
      ['goal_discovery', new GoalDiscoveryPhase(messagingService, this.stateDetector)],
      ['monthly_expenses', new MonthlyExpensesPhase(messagingService, this.stateDetector)],
      ['complete', new CompletePhase(messagingService, this.stateDetector)]
    ]);
    
    console.log('🎭 ConversationOrchestrator initialized with phases:', Array.from(this.phases.keys()));
  }
  
  /**
   * Process an incoming message through the appropriate conversation phase
   * @param {object} messageInfo - Message information
   * @returns {Promise<object>} Processing result
   */
  async processMessage(messageInfo) {
    try {
      const { userId, phoneNumber, content, messageType } = messageInfo;
      
      // Only process text messages for now
      if (messageType !== 'text' || !content) {
        console.log(`🤖 Ignoring non-text message type: ${messageType}`);
        return { processed: false, reason: 'non-text message' };
      }
      
      console.log(`🎭 Orchestrator processing message from user ${userId}: "${content}"`);
      
      // Detect current phase
      const currentPhase = await this.detectPhase(userId);
      console.log(`📍 Current phase for user ${userId}: ${currentPhase}`);
      
      // Get phase handler
      const phaseHandler = this.phases.get(currentPhase);
      if (!phaseHandler) {
        throw new Error(`Unknown phase: ${currentPhase}`);
      }
      
      // Process message through phase handler
      const result = await phaseHandler.process(messageInfo);
      
      // Log phase transition if any
      if (result.transitionTo) {
        console.log(`🔄 Phase transition: ${currentPhase} → ${result.transitionTo}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Orchestration error:', error);
      return await this.handleError(messageInfo, error);
    }
  }
  
  /**
   * Detect the current conversation phase for a user
   * @param {string} userId - User ID
   * @returns {Promise<string>} Current phase name
   */
  async detectPhase(userId) {
    return await this.stateDetector.detectPhase(userId);
  }
  
  /**
   * Handle errors during orchestration
   * @param {object} messageInfo - Message information
   * @param {Error} error - Error that occurred
   * @returns {object} Error response
   */
  async handleError(messageInfo, error) {
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      userId: messageInfo?.userId,
      phoneNumber: messageInfo?.phoneNumber,
      content: messageInfo?.content
    });
    
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
      error: error.message,
      phase: 'error'
    };
  }
  
  /**
   * Get the current conversation state for a user
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<object>} Conversation status
   */
  async getConversationStatus(phoneNumber) {
    return await this.messagingService.getConversationStatus(phoneNumber);
  }
}

module.exports = ConversationOrchestrator;