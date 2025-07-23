const OpenAI = require('openai');

class GoalIntelligence {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async analyzeGoalMessage(message, userId, context = {}) {
    try {
      console.log(`🧠 Analyzing goal message for user ${userId}: "${message}"`);
      
      const prompt = this.buildGoalAnalysisPrompt(message, context);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are Arnaldo, a warm and intelligent Brazilian financial advisor. Analyze user messages about financial goals and respond with helpful, empathetic guidance."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const aiResponse = JSON.parse(response.choices[0].message.content);
      
      console.log(`✅ Goal analysis complete:`, {
        needsClarification: aiResponse.needs_clarification,
        extractedType: aiResponse.extracted_data?.goal_type,
        confidence: aiResponse.extracted_data?.confidence
      });
      
      return aiResponse;

    } catch (error) {
      console.error('❌ Goal intelligence error:', error);
      
      // Fallback to simple parsing
      return this.fallbackGoalAnalysis(message);
    }
  }

  buildGoalAnalysisPrompt(message, context) {
    return `
    You are Arnaldo, a warm Brazilian financial advisor helping a user define their financial goal.
    
    User message: "${message}"
    Context: ${JSON.stringify(context)}
    
    Your task:
    1. Understand their financial goal completely
    2. Extract structured data if the goal is clear
    3. Ask ONE clarifying question if you need more information
    4. Be empathetic, encouraging, and conversational
    
    If the goal is clear enough, extract:
    - goal_type: "purchase" | "emergency" | "debt" | "savings" | "other"
    - item: specific thing they want (for purchases)
    - amount: monetary value if mentioned (in reais)
    - timeline: when they want to achieve it
    - confidence: how certain you are (0-1)
    
    If you need clarification, ask ONE specific question in Brazilian Portuguese.
    Be natural and helpful, not robotic.
    
    Examples of great responses:
    - "Que tipo de carro você está pensando? Algo mais básico para o dia a dia ou com mais recursos?"
    - "Legal! Quanto você gostaria de ter guardado para emergências? Uns 3, 6 meses de gastos?"
    - "Entendi que você quer economizar mais. É para algum objetivo específico ou para ter mais segurança?"
    
    IMPORTANT: Respond only in valid JSON format:
    {
      "message": "Your response in Portuguese",
      "extracted_data": {
        "goal_type": "purchase",
        "item": "carro",
        "amount": 30000,
        "timeline": "1 ano",
        "confidence": 0.8
      } or null,
      "needs_clarification": true/false,
      "next_question_focus": "budget" | "timeline" | "specifics" | "type" | null,
      "user_emotion": "excited" | "stressed" | "confused" | "neutral"
    }
    `;
  }

  async handleGoalClarification(message, userId, goalContext) {
    try {
      console.log(`🎯 Handling goal clarification for user ${userId}`);
      
      const prompt = this.buildClarificationPrompt(message, goalContext);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are Arnaldo continuing a goal conversation. Build on previous context and help complete the goal definition with warmth and intelligence."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const aiResponse = JSON.parse(response.choices[0].message.content);
      
      console.log(`✅ Clarification complete:`, {
        progressMade: !aiResponse.needs_clarification,
        nextFocus: aiResponse.next_question_focus
      });
      
      return aiResponse;

    } catch (error) {
      console.error('❌ Goal clarification error:', error);
      return this.fallbackClarification(message, goalContext);
    }
  }

  buildClarificationPrompt(message, goalContext) {
    return `
    You are Arnaldo continuing a goal conversation.
    
    Previous goal context: ${JSON.stringify(goalContext)}
    User's new message: "${message}"
    
    The user is responding to your previous clarification question.
    
    Your goal: Continue building their complete goal definition with empathy.
    
    Current goal state: ${goalContext.partial_goal || 'undefined'}
    What you were asking about: ${goalContext.last_question_focus || 'general goal'}
    Missing information: ${goalContext.missing_fields || ['unknown']}
    
    Instructions:
    1. If they gave you what you asked for, acknowledge it warmly and extract the data
    2. If the goal is now complete, create encouraging summary and prepare for next step
    3. If you still need info, ask for the next missing piece naturally
    4. If they seem confused, rephrase more clearly with examples
    5. Stay encouraging and personal
    
    Examples of good responses:
    - "Perfeito! Um carro usado é uma escolha inteligente 👍 Qual faixa de preço você está considerando? Até 20 mil, 30 mil, mais que isso?"
    - "Ótimo! 6 meses de reserva é uma meta excelente. Quando você gostaria de ter isso pronto? Este ano, no próximo ano?"
    - "Entendi! Para ter mais segurança financeira faz todo sentido. Vamos definir uma meta: quanto você gostaria de economizar por mês?"
    
    If the goal is complete, create an exciting summary like:
    "🎯 OBJETIVO DEFINIDO!\\n\\nComprar um carro usado (até R$30.000) em 1 ano\\nVou te ajudar a realizar esse sonho! 🚗\\n\\nPara criar seu plano personalizado, me conta quanto você ganha por mês?"
    
    Respond in the same JSON format as before.
    `;
  }

  async createGoalSummary(goalData, userId) {
    try {
      const prompt = `
      You are Arnaldo creating an exciting summary of the user's financial goal.
      
      Goal details: ${JSON.stringify(goalData)}
      
      Create an encouraging summary that:
      1. Confirms their goal clearly with an emoji
      2. Shows you understand their dream/priority
      3. Builds excitement and confidence
      4. Transitions naturally to income discussion
      
      Examples:
      - "🎯 OBJETIVO DEFINIDO!\\n\\nComprar um carro usado (R$30.000) em 1 ano\\nVou te ajudar a chegar lá! 🚗\\n\\nPara criar seu plano personalizado, me conta quanto você ganha por mês?"
      
      - "🛡️ RESERVA DE EMERGÊNCIA!\\n\\n6 meses de proteção financeira\\nExcelente prioridade! Segurança em primeiro lugar.\\n\\nPara calcular sua meta exata, preciso saber sua renda mensal. Quanto você ganha?"
      
      - "💪 LIBERDADE FINANCEIRA!\\n\\nQuitar R$15.000 em dívidas\\nVamos criar um plano para você sair dessa! 🎉\\n\\nPrimeiro, me fala quanto você ganha por mês para montarmos a estratégia?"
      
      Make it feel personal, achievable, and exciting!
      `;
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 300
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('❌ Goal summary error:', error);
      return this.fallbackSummary(goalData);
    }
  }

  // Fallback methods for when AI fails
  fallbackGoalAnalysis(message) {
    const text = message.toLowerCase();
    
    // Simple pattern matching
    if (text.includes('carro') || text.includes('casa') || text.includes('comprar')) {
      return {
        message: "Que tipo de compra você tem em mente? Me conta mais detalhes!",
        extracted_data: { goal_type: "purchase", confidence: 0.6 },
        needs_clarification: true,
        next_question_focus: "specifics",
        user_emotion: "neutral"
      };
    }
    
    if (text.includes('reserva') || text.includes('emergência') || text.includes('guardar')) {
      return {
        message: "Criar uma reserva de emergência é muito inteligente! Quantos meses de gastos você quer guardar?",
        extracted_data: { goal_type: "emergency", confidence: 0.7 },
        needs_clarification: true,
        next_question_focus: "amount",
        user_emotion: "neutral"
      };
    }
    
    // Generic response
    return {
      message: "Me conta mais sobre seu objetivo financeiro. O que você mais quer conquistar agora?",
      extracted_data: null,
      needs_clarification: true,
      next_question_focus: "type",
      user_emotion: "neutral"
    };
  }

  fallbackClarification(message, goalContext) {
    return {
      message: "Perfeito! Vamos continuar definindo seu objetivo. Me fala mais detalhes para eu te ajudar melhor.",
      extracted_data: goalContext.partial_goal,
      needs_clarification: true,
      next_question_focus: "details",
      user_emotion: "neutral"
    };
  }

  fallbackSummary(goalData) {
    const { goal_type, item, amount } = goalData;
    
    if (goal_type === 'purchase' && item) {
      return `🎯 OBJETIVO DEFINIDO!\n\n${item}${amount ? ` (R$${amount.toLocaleString('pt-BR')})` : ''}\nVou te ajudar a realizar esse sonho!\n\nPara criar seu plano, me conta quanto você ganha por mês?`;
    }
    
    return "🎯 Objetivo definido! Vamos criar seu plano financeiro personalizado.\n\nPara começar, me conta quanto você ganha por mês?";
  }

  // Helper method to extract amounts from text
  extractAmount(text) {
    const patterns = [
      /(\d+)\s*mil/i,           // "30 mil"
      /r\$?\s*(\d+\.?\d*)/i,    // "R$30000" or "R$30.000"
      /(\d+)\s*reais/i,         // "30000 reais"
      /(\d+\.?\d*)\s*k/i        // "30k"
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let amount = parseFloat(match[1].replace('.', ''));
        if (text.includes('mil') || text.includes('k')) {
          amount *= 1000;
        }
        return amount;
      }
    }
    
    return null;
  }

  // Helper to detect timeline mentions
  extractTimeline(text) {
    const patterns = [
      /(\d+)\s*ano/i,           // "1 ano"
      /(\d+)\s*meses?/i,        // "6 meses"
      /este\s+ano/i,            // "este ano"
      /próximo\s+ano/i,         // "próximo ano"
      /até\s+(\w+)/i            // "até dezembro"
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }
}

module.exports = GoalIntelligence;