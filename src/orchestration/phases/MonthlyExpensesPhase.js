const ConversationPhase = require('../ConversationPhase');
const ArnaldoMonthlyExpenses = require('../../services/ArnaldoMonthlyExpenses');

/**
 * MonthlyExpensesPhase - Handles monthly expenses discovery conversation
 */
class MonthlyExpensesPhase extends ConversationPhase {
  constructor(messagingService, stateDetector) {
    super(messagingService, stateDetector);
    this.monthlyExpensesAI = new ArnaldoMonthlyExpenses();
  }
  
  getName() {
    return 'monthly_expenses';
  }
  
  async process(messageInfo) {
    try {
      const { userId, phoneNumber, content } = messageInfo;
      
      console.log(`💰 Processing monthly expenses phase for user ${userId}`);
      
      const expenseResponse = await this.monthlyExpensesAI.processMessage(phoneNumber, content);
      console.log(`💰 Expenses response:`, expenseResponse);
      
      await this.messagingService.sendMessage(phoneNumber, expenseResponse.response);
      
      // Check if expenses discovery is complete
      if (expenseResponse.expensesComplete) {
        console.log(`✅ Monthly expenses discovery complete for user ${userId}!`);
        
        return {
          processed: true,
          phase: 'monthly_expenses',
          action: 'sent_expenses_response',
          expensesComplete: true,
          sentMessage: true,
          transitionTo: 'complete'
        };
      } else {
        return {
          processed: true,
          phase: 'monthly_expenses',
          action: 'sent_expenses_response',
          expensesComplete: false,
          sentMessage: true
        };
      }
      
    } catch (error) {
      console.error('❌ Error in MonthlyExpensesPhase:', error);
      throw error;
    }
  }
}

module.exports = MonthlyExpensesPhase;