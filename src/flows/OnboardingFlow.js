const ConversationState = require('../services/ConversationState');
const Goal = require('../models/Goal');

class OnboardingFlow {
  
  static async handleOnboarding(userId, userState, message = '') {
    const messageText = message?.toLowerCase() || '';
    
    switch (userState) {
      case ConversationState.STATES.NEW_USER:
      case ConversationState.STATES.ONBOARDING_WELCOME:
        return this.sendWelcome(userId);
        
      case ConversationState.STATES.GOAL_DISCOVERY:
        return this.handleGoalDiscovery(userId, messageText);
        
      case ConversationState.STATES.INCOME_COLLECTION:
        return this.handleIncomeCollection(userId, messageText);
        
      case ConversationState.STATES.PLAN_CREATION:
        return this.handlePlanCreation(userId);
        
      default:
        return this.sendWelcome(userId);
    }
  }
  
  static async sendWelcome(userId) {
    // Update state to goal discovery for next message
    await ConversationState.updateUserState(
      userId, 
      ConversationState.STATES.GOAL_DISCOVERY,
      { stage: 'welcome_shown' }
    );
    
    return {
      message: `Oi! Sou o Arnaldo, seu consultor financeiro pessoal! 👋

Vou te ajudar a organizar suas finanças e realizar seus sonhos.

Primeiro, me conta: qual é seu MAIOR objetivo financeiro agora?

1️⃣ Criar reserva de emergência
2️⃣ Comprar algo específico (casa, carro...)
3️⃣ Quitar dívidas
4️⃣ Aumentar minha renda

Responde só o número da sua prioridade!`
    };
  }
  
  static async handleGoalDiscovery(userId, messageText) {
    // Parse the goal selection
    let goalType = '';
    let goalMessage = '';
    let followUpMessage = '';
    
    if (messageText.includes('1') || messageText.includes('reserva') || messageText.includes('emergência')) {
      goalType = 'emergency_fund';
      goalMessage = 'Reserva de emergência - excelente escolha! 🛡️';
      followUpMessage = 'Vamos criar sua proteção financeira. Quantos meses de gastos você quer guardar? (Recomendo 3-6 meses)';
      
    } else if (messageText.includes('2') || messageText.includes('comprar') || messageText.includes('casa') || messageText.includes('carro')) {
      goalType = 'big_purchase';
      goalMessage = 'Sonho de compra - vamos tornar realidade! 🏠🚗';
      followUpMessage = 'Me conta: o que você quer comprar e quanto custa aproximadamente?';
      
    } else if (messageText.includes('3') || messageText.includes('dívida') || messageText.includes('quitar')) {
      goalType = 'debt_freedom';
      goalMessage = 'Liberdade financeira - foco total! 💪';
      followUpMessage = 'Quanto você deve no total? Vamos criar um plano para te livrar dessas dívidas!';
      
    } else if (messageText.includes('4') || messageText.includes('renda') || messageText.includes('aumentar')) {
      goalType = 'increase_income';
      goalMessage = 'Aumentar renda - estratégia inteligente! 📈';
      followUpMessage = 'Quanto você ganha hoje e quanto quer chegar a ganhar?';
      
    } else {
      // Default response for unclear input
      return {
        message: `Não entendi bem. Escolhe uma opção:

1️⃣ Reserva de emergência
2️⃣ Comprar algo específico
3️⃣ Quitar dívidas  
4️⃣ Aumentar renda

Só responde o número!`,
        nextState: ConversationState.STATES.GOAL_DISCOVERY
      };
    }
    
    // Create goal in database
    try {
      const goal = await Goal.create({
        userId,
        type: goalType,
        name: goalType.replace('_', ' '),
        targetAmount: 1000, // Will be updated based on follow-up
        targetDate: null
      });
      
      // Update state to income collection
      await ConversationState.updateUserState(
        userId, 
        ConversationState.STATES.INCOME_COLLECTION,
        { 
          goalType,
          goalId: goal.id,
          stage: 'goal_selected' 
        }
      );
    } catch (error) {
      console.log('Goal creation skipped (testing mode):', error.message);
      // Still update state even if goal creation fails
      await ConversationState.updateUserState(
        userId, 
        ConversationState.STATES.INCOME_COLLECTION,
        { goalType, stage: 'goal_selected' }
      );
    }
    
    return {
      message: `${goalMessage}

${followUpMessage}`
    };
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