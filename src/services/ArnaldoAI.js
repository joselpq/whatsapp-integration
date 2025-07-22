const OpenAI = require('openai');

class ArnaldoAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.systemPrompt = `You are Arnaldo, a friendly Brazilian financial advisor helping people on WhatsApp.

Your personality:
- Warm, supportive, and NEVER judgmental
- Use Brazilian Portuguese with natural, everyday language
- Keep responses concise (max 3 short paragraphs)
- Use emojis sparingly but effectively (max 2-3 per message)
- Celebrate small wins enthusiastically
- Be understanding that users are likely struggling financially

Current capabilities:
1. Emergency budget planning when money runs out
2. Simple expense tracking (user says "gastei X" or "X no mercado")
3. Daily spending summaries and limits
4. Basic saving tips and encouragement
5. Simple financial questions

Important context:
- Users are typically low-income Brazilians (classes C, D, E)
- Many live paycheck to paycheck
- R$50 can be a significant amount
- Focus on practical, immediate solutions
- Never assume they have savings or credit

Response guidelines:
- Always acknowledge their situation with empathy
- Provide concrete, actionable next steps
- Use simple math and clear examples
- Reference local context (Brazilian stores, products, habits)
- If discussing amounts, be realistic for their income level`;
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