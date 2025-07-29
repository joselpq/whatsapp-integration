const ConversationPhase = require('../ConversationPhase');

/**
 * CompletePhase - Handles completed conversations (no further responses)
 */
class CompletePhase extends ConversationPhase {
  getName() {
    return 'complete';
  }
  
  async process(messageInfo) {
    const { userId } = messageInfo;
    
    console.log(`🏁 Conversation complete for user ${userId} - not responding`);
    
    // Conversation is complete - no response needed
    return {
      processed: false,
      phase: 'complete',
      reason: 'conversation_complete',
      sentMessage: false
    };
  }
}

module.exports = CompletePhase;