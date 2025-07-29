const ConversationPhase = require('../ConversationPhase');

/**
 * WelcomePhase - Handles first-time user welcome messages
 */
class WelcomePhase extends ConversationPhase {
  getName() {
    return 'welcome';
  }
  
  async process(messageInfo) {
    try {
      const { phoneNumber } = messageInfo;
      
      console.log(`👋 Processing welcome phase for ${phoneNumber}`);
      
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
      
      return {
        processed: true,
        phase: 'welcome',
        action: 'sent_welcome',
        sentMessage: true,
        transitionTo: 'goal_discovery'
      };
      
    } catch (error) {
      console.error('❌ Error in WelcomePhase:', error);
      throw error;
    }
  }
}

module.exports = WelcomePhase;