const ConversationPhase = require('../ConversationPhase');
const ArnaldoGoalDiscovery = require('../../services/ArnaldoGoalDiscovery');

/**
 * GoalDiscoveryPhase - Handles financial goal discovery conversation
 */
class GoalDiscoveryPhase extends ConversationPhase {
  constructor(messagingService, stateDetector) {
    super(messagingService, stateDetector);
    this.goalDiscoveryAI = new ArnaldoGoalDiscovery();
  }
  
  getName() {
    return 'goal_discovery';
  }
  
  async process(messageInfo) {
    try {
      const { userId, phoneNumber, content } = messageInfo;
      
      console.log(`🎯 Processing goal discovery phase for user ${userId}`);
      
      // Check if last message was goal confirmation question
      const lastMessage = await this.stateDetector.getLastOutboundMessage(userId);
      console.log(`📝 Last message:`, lastMessage);
      
      const askedGoalConfirmation = lastMessage && lastMessage.includes('Podemos considerar este objetivo e seguir para a próxima etapa?');
      console.log(`❓ Asked goal confirmation: ${askedGoalConfirmation}`);
      
      if (askedGoalConfirmation && this._isAffirmativeResponse(content)) {
        // User confirmed goal - transition to expenses phase
        console.log(`✅ User confirmed goal with "${content}", transitioning to expenses`);
        
        const transitionMessage = `Perfeito! Agora vamos entender seus gastos mensais para criar um plano de economia eficiente. 📊

Vamos começar: quanto você gasta por mês com moradia (aluguel, financiamento, condomínio)?`;

        await this.messagingService.sendMessage(phoneNumber, transitionMessage);
        
        return {
          processed: true,
          phase: 'goal_discovery',
          action: 'goal_confirmed_transitioning',
          goalComplete: true,
          sentMessage: true,
          transitionTo: 'monthly_expenses'
        };
      } else {
        // Continue goal discovery conversation
        console.log(`🔍 Continuing goal discovery for user ${userId}`);
        
        const goalResponse = await this.goalDiscoveryAI.chat(content, userId);
        console.log(`🤖 Goal discovery response:`, goalResponse);
        
        await this.messagingService.sendMessage(phoneNumber, goalResponse.message);
        
        return {
          processed: true,
          phase: 'goal_discovery',
          action: 'sent_goal_discovery_response',
          goalComplete: false,
          sentMessage: true
        };
      }
      
    } catch (error) {
      console.error('❌ Error in GoalDiscoveryPhase:', error);
      throw error;
    }
  }
}

module.exports = GoalDiscoveryPhase;