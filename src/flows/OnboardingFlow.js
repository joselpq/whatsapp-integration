const ConversationState = require('../services/ConversationState');
const Goal = require('../models/Goal');
const GoalIntelligence = require('../services/GoalIntelligence');

class OnboardingFlow {
  
  static async handleOnboarding(userId, userState, message = '') {
    const messageText = message?.toLowerCase() || '';
    
    switch (userState) {
      case ConversationState.STATES.NEW_USER:
      case ConversationState.STATES.ONBOARDING_WELCOME:
        return this.sendWelcome(userId);
        
      case ConversationState.STATES.GOAL_DISCOVERY:
        return this.handleGoalDiscovery(userId, messageText);
        
      case ConversationState.STATES.GOAL_CLARIFICATION:
        return this.handleGoalClarification(userId, messageText);
        
      case ConversationState.STATES.GOAL_COMPLETE:
        return this.handleGoalComplete(userId, messageText);
        
      default:
        return this.sendWelcome(userId);
    }
  }
  
  static async sendWelcome(userId) {
    // Update state to goal discovery for next message
    await ConversationState.updateUserState(
      userId, 
      ConversationState.STATES.GOAL_DISCOVERY,
      { stage: 'welcome_shown', attempt: 1 }
    );
    
    return {
      message: `Oi! Sou o Arnaldo, seu consultor financeiro pessoal! 👋

Vou te ajudar a organizar suas finanças e realizar seus sonhos.

Me conta: qual é seu MAIOR objetivo financeiro agora?

Pode ser qualquer coisa:
💰 Criar reserva de emergência
🏠 Comprar casa, carro, celular...
💳 Quitar dívidas
💡 Economizar mais dinheiro
🎓 Fazer curso, viagem...
🤷 Não sei bem ainda

Me fala com suas palavras!`
    };
  }
  
  static async handleGoalDiscovery(userId, messageText) {
    try {
      console.log(`🎯 Starting AI-first goal discovery for user ${userId}`);
      
      // Get current context
      const stateContext = await ConversationState.getStateContext(userId);
      const context = {
        attempt: (stateContext?.context?.attempt || 0) + 1,
        stage: 'initial_discovery'
      };
      
      // Use AI to analyze the goal message
      const goalIntelligence = new GoalIntelligence();
      const aiResponse = await goalIntelligence.analyzeGoalMessage(messageText, userId, context);
      
      // Process the AI response
      if (aiResponse.needs_clarification) {
        // Need more information - transition to clarification state
        await ConversationState.updateUserState(
          userId,
          ConversationState.STATES.GOAL_CLARIFICATION,
          {
            partial_goal: aiResponse.extracted_data,
            last_question_focus: aiResponse.next_question_focus,
            user_emotion: aiResponse.user_emotion,
            attempt: context.attempt
          }
        );
        
        return {
          message: aiResponse.message
        };
      } else {
        // Goal is complete - save and proceed
        return await this.completeGoalDefinition(userId, aiResponse.extracted_data);
      }
      
    } catch (error) {
      console.error('❌ Error in AI goal discovery:', error);
      
      // Fallback to simple goal discovery
      return this.fallbackGoalDiscovery(userId, messageText);
    }
  }
  
  static async handleIncomeCollection(userId, messageText) {
    // This will be handled by the IncomeParser in the main flow
    // But we need to provide guidance
    
    if (!messageText.match(/\d+/)) {
      // No number found - ask again
      return {
        message: `Para criar seu plano personalizado, preciso saber quanto você ganha por mês.

Me fala seu salário ou renda mensal. Por exemplo:
"Ganho 2500 por mês"
"Meu salário é 3000"

Pode ficar tranquilo, essa info fica só entre nós! 🔒`
      };
    }
    
    // If they provided a number, this will be handled by IncomeParser
    // The response here is just fallback
    return {
      message: `Perfeito! Agora vamos entender seus gastos.

Nos próximos dias, me manda suas despesas assim:
"Gastei 50 no mercado"
"Uber 15 reais"
"Almoço 12"

Depois de alguns dias, vou criar seu plano financeiro completo! 📊

Por enquanto, qual seu gasto mais pesado do mês?`,
      completeOnboarding: true
    };
  }
  
  static async handlePlanCreation(userId) {
    // Get user data to create personalized plan
    const userQuery = `
      SELECT monthly_income FROM users WHERE id = $1
    `;
    const db = require('../database/db');
    const result = await db.query(userQuery, [userId]);
    const user = result.rows[0];
    
    const income = user?.monthly_income || 2000;
    
    // Calculate recommendations based on income
    const emergencyFund = Math.round(income * 3); // 3 months of income
    const monthlySavings = Math.round(income * 0.2); // 20% savings rate
    const dailyBudget = Math.round((income * 0.6) / 30); // 60% for variable expenses
    
    // Complete onboarding and move to active tracking
    await ConversationState.completeOnboarding(userId);
    
    return {
      message: `🎯 SEU PLANO FINANCEIRO PERSONALIZADO

Com renda de R$${income.toLocaleString('pt-BR')}:

💰 META DE POUPANÇA: R$${monthlySavings}/mês
🛡️ RESERVA DE EMERGÊNCIA: R$${emergencyFund.toLocaleString('pt-BR')}
💳 ORÇAMENTO DIÁRIO: R$${dailyBudget}

Vamos começar! Me manda seus gastos que eu acompanho tudo.

Primeira meta: economizar R$${Math.round(monthlySavings/4)} esta semana! 🚀`,
      completeOnboarding: true
    };
  }
  
  static async handleGoalClarification(userId, messageText) {
    try {
      console.log(`🎯 Handling goal clarification for user ${userId}`);
      
      // Get current goal context
      const stateContext = await ConversationState.getStateContext(userId);
      const goalContext = {
        partial_goal: stateContext?.context?.partial_goal,
        last_question_focus: stateContext?.context?.last_question_focus,
        missing_fields: stateContext?.context?.missing_fields,
        attempt: (stateContext?.context?.attempt || 0) + 1
      };
      
      // Use AI to handle the clarification
      const goalIntelligence = new GoalIntelligence();
      const aiResponse = await goalIntelligence.handleGoalClarification(messageText, userId, goalContext);
      
      if (aiResponse.needs_clarification) {
        // Still need more info - update context and continue
        await ConversationState.updateUserState(
          userId,
          ConversationState.STATES.GOAL_CLARIFICATION,
          {
            partial_goal: aiResponse.extracted_data,
            last_question_focus: aiResponse.next_question_focus,
            user_emotion: aiResponse.user_emotion,
            attempt: goalContext.attempt
          }
        );
        
        return {
          message: aiResponse.message
        };
      } else {
        // Goal is now complete
        return await this.completeGoalDefinition(userId, aiResponse.extracted_data);
      }
      
    } catch (error) {
      console.error('❌ Error in goal clarification:', error);
      
      // Fallback response
      return {
        message: "Perfeito! Vamos continuar definindo seu objetivo. Me conta mais detalhes para eu te ajudar melhor."
      };
    }
  }
  
  static async completeGoalDefinition(userId, goalData) {
    try {
      console.log(`✅ Completing goal definition for user ${userId}:`, goalData);
      
      // Create the goal in database
      const goal = await Goal.create({
        userId,
        type: goalData.goal_type || 'other',
        name: goalData.item || goalData.goal_type || 'Meta financeira',
        targetAmount: goalData.amount || 1000,
        targetDate: goalData.timeline ? this.parseTargetDate(goalData.timeline) : null,
        description: JSON.stringify(goalData)
      });
      
      // Mark onboarding as complete - goal discovery is done
      await ConversationState.completeOnboarding(userId);
      
      // Generate final goal confirmation message
      const goalSummary = this.formatGoalSummary(goalData);
      
      return {
        message: `Então seu objetivo é: ${goalSummary}! 🎯

Agora você tem sua meta bem definida. Sucesso na sua jornada financeira! 💪`,
        completeOnboarding: true
      };
      
    } catch (error) {
      console.error('❌ Error completing goal definition:', error);
      
      // Fallback - complete onboarding anyway
      await ConversationState.completeOnboarding(userId);
      
      return {
        message: "Então seu objetivo está definido! 🎯 Agora você tem uma meta clara para trabalhar. Boa sorte! 💪",
        completeOnboarding: true
      };
    }
  }
  
  static formatGoalSummary(goalData) {
    const item = goalData.item || goalData.goal_type || 'sua meta financeira';
    const amount = goalData.amount ? `R$ ${goalData.amount.toLocaleString('pt-BR')}` : '';
    const timeline = goalData.timeline || '';
    
    let summary = item;
    
    if (amount && timeline) {
      summary += ` de ${amount} até ${timeline}`;
    } else if (amount) {
      summary += ` de ${amount}`;
    } else if (timeline) {
      summary += ` até ${timeline}`;
    }
    
    return summary;
  }
  
  static async handleGoalComplete(userId, messageText) {
    // Goal is already complete - remind user and keep conversation open for new goals
    return {
      message: "Seu objetivo financeiro já está bem definido! 🎯 Se quiser definir uma nova meta, é só me contar!"
    };
  }
  
  static fallbackGoalDiscovery(userId, messageText) {
    console.log('🔄 Using fallback goal discovery');
    
    const text = messageText.toLowerCase();
    
    // Simple pattern matching for common goals
    if (text.includes('carro') || text.includes('casa') || text.includes('comprar')) {
      return {
        message: "Entendi que você quer fazer uma compra! Me conta mais detalhes: o que você quer comprar e qual faixa de preço?"
      };
    }
    
    if (text.includes('reserva') || text.includes('emergência') || text.includes('guardar')) {
      return {
        message: "Criar uma reserva de emergência é muito inteligente! Quantos meses de gastos você quer guardar? Recomendo entre 3 a 6 meses."
      };
    }
    
    if (text.includes('dívida') || text.includes('quitar') || text.includes('pagar')) {
      return {
        message: "Vamos te ajudar a quitar suas dívidas! Quanto você deve no total? Cartão, financiamentos, empréstimos..."
      };
    }
    
    // Generic fallback
    return {
      message: "Me conta mais sobre seu objetivo financeiro. O que você mais quer conquistar agora? Pode ser uma compra, guardar dinheiro, quitar dívidas..."
    };
  }
  
  static parseTargetDate(timeline) {
    // Simple timeline parsing
    const text = timeline.toLowerCase();
    const now = new Date();
    
    if (text.includes('ano') || text.includes('year')) {
      const match = text.match(/(\d+)/);
      const years = match ? parseInt(match[1]) : 1;
      return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
    }
    
    if (text.includes('meses') || text.includes('month')) {
      const match = text.match(/(\d+)/);
      const months = match ? parseInt(match[1]) : 6;
      return new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    }
    
    // Default to 1 year if unclear
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
  
  static getEmergencyResponse() {
    return {
      message: `🚨 Situação de emergência identificada!

Vamos resolver isso juntos:

1. Quantos dias até o próximo dinheiro entrar?
2. Quanto você tem disponível agora?
3. Quais gastos são ESSENCIAIS até lá?

Me responde uma pergunta por vez que eu monto um plano de sobrevivência!`,
      nextState: ConversationState.STATES.EMERGENCY_MODE
    };
  }
}

module.exports = OnboardingFlow;