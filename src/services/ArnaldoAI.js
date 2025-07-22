const OpenAI = require('openai');

class ArnaldoAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.systemPrompt = `You are Arnaldo, a friendly Brazilian financial advisor on WhatsApp.

Personality:
- Warm, supportive, never judgmental
- Use natural Brazilian Portuguese
- KEEP RESPONSES SHORT (max 2 sentences for simple questions, max 4 sentences for complex advice)
- Use 1-2 emojis per message maximum
- Celebrate small wins

Capabilities:
- Track expenses ("gastei X no mercado")
- Budget planning and daily limits
- Emergency financial help
- Savings tips

Context:
- Users are low-income Brazilians (classes C, D, E)
- Many live paycheck to paycheck  
- R$50 is significant money
- Focus on practical, immediate solutions

Response style:
- Be direct and helpful
- Don't repeat information unnecessarily
- Ask ONE clear question at a time
- Give specific, actionable advice`;
  }

  async processMessage(message, context) {
    try {
      // Build conversation history for context
      const messages = this.buildConversationHistory(context);
      
      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      // Get AI response
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500, // Keep responses concise
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('AI processing error:', error);
      
      // Fallback response
      return 'Oi! Tive um probleminha técnico aqui 😅 Pode repetir sua mensagem? Prometo que vou te ajudar!';
    }
  }

  buildConversationHistory(context) {
    const messages = [];
    
    // Add user profile context if available
    if (context.profile && context.profile.monthly_income) {
      messages.push({
        role: 'system',
        content: `User context: Monthly income R$${context.profile.monthly_income}, payday on day ${context.profile.payday || 'unknown'}`
      });
    }

    // Add recent conversation (last 5 messages)
    if (context.messages && context.messages.length > 0) {
      const recentMessages = context.messages.slice(-5);
      
      recentMessages.forEach(msg => {
        messages.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.content.text || msg.content
        });
      });
    }

    // Add expense summary if available
    if (context.expenses && context.expenses.todayTotal !== undefined) {
      messages.push({
        role: 'system',
        content: `Today's spending: R$${context.expenses.todayTotal.toFixed(2)}, Daily budget: R$${context.expenses.dailyBudget?.toFixed(2) || 'not set'}`
      });
    }

    return messages;
  }

  // Specific response generators for common scenarios
  async generateEmergencyPlan(daysUntilPayday, availableMoney) {
    const prompt = `User has R$${availableMoney} and needs to survive ${daysUntilPayday} days until payday. 
    Create a practical daily budget and survival plan. Be specific and encouraging.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    return completion.choices[0].message.content;
  }

  async generateDailySummary(expenses, budget) {
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = budget - totalSpent;
    
    const prompt = `User spent R$${totalSpent.toFixed(2)} today (budget was R$${budget.toFixed(2)}).
    Expenses: ${expenses.map(e => `${e.category}: R$${e.amount}`).join(', ')}
    Generate an encouraging daily summary with specific feedback.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return completion.choices[0].message.content;
  }
}

module.exports = ArnaldoAI;