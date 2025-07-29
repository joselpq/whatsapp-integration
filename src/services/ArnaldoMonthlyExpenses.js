const OpenAI = require('openai');
const Message = require('../models/Message');

class ArnaldoMonthlyExpenses {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processMessage(phoneNumber, message) {
    try {
      console.log(`💰 ArnaldoMonthlyExpenses processing message from ${phoneNumber}: "${message}"`);

      // Get userId from phoneNumber
      const userId = await this.getUserIdFromPhone(phoneNumber);
      const response = await this.chat(userId, message);
      
      console.log(`💰 ArnaldoMonthlyExpenses response: "${response}"`);
      
      return response;
    } catch (error) {
      console.error('❌ Error in ArnaldoMonthlyExpenses:', error);
      return 'Desculpe, tive um problema técnico. Pode repetir sua resposta?';
    }
  }

  async chat(userId, message) {
    try {
      // Get complete conversation history
      const history = await this.getConversationHistory(userId);
      
      // Build messages for ChatGPT with Arnaldo's expense discovery mission
      const messages = [
        {
          role: 'system',
          content: `Você é o Arnaldo, um consultor financeiro brasileiro amigável com UMA ÚNICA MISSÃO: descobrir e organizar TODOS os custos mensais do usuário.

CONTEXTO TEMPORAL: Estamos em julho de 2025. Use isso para calcular datas futuras corretamente.

SEU ÚNICO OBJETIVO: Descobrir TODOS os gastos mensais do usuário em TODAS as categorias, organizados por valor.

CATEGORIAS OBRIGATÓRIAS (DEVE descobrir TODAS):
1. Moradia (apenas aluguel OU financiamento + condomínio + IPTU)
2. Alimentação (mercado + delivery + restaurantes)
3. Transporte (combustível/transporte público + financiamento/seguro veículo)
4. Saúde (plano de saúde + remédios + consultas)
5. Educação (cursos + livros + escola/faculdade)
6. Lazer (streaming + cinema + bares + hobbies + viagens)
7. Vestuário (roupas + calçados + acessórios)
8. Gastos eventuais anuais (seguro carro/casa + manutenções + presentes + viagem anual)

REGRAS CRÍTICAS DE ESTIMATIVA:
1. NUNCA sugira valores direto - SEMPRE tente ajudar o usuário a estimar primeiro
2. Se usuário não souber, faça perguntas específicas para ajudar a descobrir:
   - "Quanto você gasta por semana no mercado?"
   - "Quantas vezes por semana come fora? Quanto gasta normalmente?"
   - "Tem Netflix, Spotify? Quantos são?"
   - "Faz alguma viagem por ano? Quanto costuma gastar?"
3. APENAS se mesmo com suas perguntas o usuário não conseguir estimar, aí você sugere um valor
4. Para gastos anuais/eventuais: divida por 12 para incluir como gasto mensal

REGRAS DE CONVERSAÇÃO:
1. Faça APENAS UMA pergunta por categoria por vez (não pergunte "aluguel, financiamento, condomínio" - pergunte só "aluguel" primeiro)
2. Para cada categoria, descubra TODOS os sub-itens antes de passar para próxima
3. SEMPRE confirme valores mencionados antes de seguir em frente
4. Seja conciso - máximo 2-3 frases curtas por resposta
5. Use linguagem simples e calorosa do português brasileiro
6. Use no máximo 1-2 emojis por mensagem

FINALIZAÇÃO OBRIGATÓRIA:
Quando tiver descoberto gastos em TODAS as 8 categorias obrigatórias, responda:
"Então essa é a estimativa dos seus custos mensais:" 
[lista organizada do MAIOR para o MENOR gasto com valores]
"Total mensal: R$ [soma total]
Isso inclui uma estimativa mensal dos gastos anuais. Está correto assim?"

IMPORTANTE: 
- NUNCA finalize sem ter descoberto TODAS as 8 categorias
- SEMPRE tente ajudar a estimar antes de sugerir valores
- SEMPRE confirme se a lista final está correta`
        },
        ...history,
        {
          role: 'user',
          content: message
        }
      ];

      console.log(`💰 Arnaldo Expenses processing message with ${history.length} messages of history`);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.3, // Reduced for more consistent responses
        max_tokens: 300, // Keeping responses concise
      });

      const response = completion.choices[0].message.content;
      console.log(`✅ Arnaldo Expenses response: "${response}"`);
      
      // Check if expenses are complete
      const areExpensesComplete = response.includes("Então essa é a estimativa dos seus custos mensais:");
      
      return {
        response,
        expensesComplete: areExpensesComplete
      };
      
    } catch (error) {
      console.error('❌ Error in Arnaldo Expenses chat:', error);
      throw error;
    }
  }

  async getConversationHistory(userId) {
    try {
      const db = require('../database/db');
      
      // Get all messages for this user, ordered by time
      const query = `
        SELECT 
          m.direction,
          m.content,
          m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
        ORDER BY m.created_at ASC
      `;
      
      const result = await db.query(query, [userId]);
      
      console.log(`📚 Loaded ${result.rows.length} historical messages for user ${userId}`);
      
      return result.rows.map(row => {
        // Extract text content from JSON if needed
        let content = row.content;
        if (typeof content === 'string') {
          try {
            const parsed = JSON.parse(content);
            content = parsed.text || parsed.body || content;
          } catch (e) {
            // If not JSON, use as-is
          }
        } else if (content?.text) {
          content = content.text;
        }
        
        return {
          role: row.direction === 'inbound' ? 'user' : 'assistant',
          content: content
        };
      });
      
    } catch (error) {
      console.error('❌ Error getting conversation history:', error);
      return [];
    }
  }

  async getUserIdFromPhone(phoneNumber) {
    try {
      const db = require('../database/db');
      const query = `SELECT id FROM users WHERE phone_number = $1`;
      const result = await db.query(query, [phoneNumber]);
      
      if (result.rows.length === 0) {
        throw new Error(`User not found for phone number: ${phoneNumber}`);
      }
      
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error getting user ID:', error);
      throw error;
    }
  }
}

module.exports = ArnaldoMonthlyExpenses;