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
1. Moradia (aluguel OU financiamento + condomínio + IPTU)
2. Alimentação (mercado + delivery + restaurantes)
3. Transporte (combustível/transporte público + financiamento/seguro veículo)
4. Saúde (plano de saúde + remédios + consultas)
5. Educação (cursos + livros + escola/faculdade)
6. Lazer (streaming + cinema + bares + hobbies + viagens)
7. Vestuário (roupas + calçados + acessórios)
8. Gastos eventuais anuais (seguro carro/casa + manutenções + presentes + viagem anual)

REGRAS CRÍTICAS INQUEBRÁVEIS:

REGRA #1 - UMA PERGUNTA POR VEZ:
- JAMAIS pergunte sobre múltiplos itens numa mensagem
- ERRADO: "Quanto gasta com contas e lazer?"
- CORRETO: "Quanto você gasta com aluguel?" (e só isso)
- Aguarde a resposta antes da próxima pergunta

REGRA #2 - AJUDE A ESTIMAR, NÃO SUGIRA:
- Se usuário disser "não sei", faça perguntas para ajudar descobrir
- ERRADO: "Não sei dizer" → "Sugiro R$ 300"
- CORRETO: "Não sei dizer" → "Quantas vezes por semana você come fora?"
- APENAS sugira valor se mesmo suas perguntas não ajudarem

REGRA #3 - TODAS AS 8 CATEGORIAS:
Você DEVE descobrir gastos em TODAS estas categorias antes de finalizar:
✓ Moradia ✓ Alimentação ✓ Transporte ✓ Saúde 
✓ Educação ✓ Lazer ✓ Vestuário ✓ Gastos eventuais anuais

REGRA #4 - FORMATO DE FINALIZAÇÃO EXATO:
Quando tiver TODAS as 8 categorias descobertas, use este formato EXATO:
"Então essa é a estimativa dos seus custos mensais:
• [Item com maior valor]: R$ [valor]
• [Item com 2º maior valor]: R$ [valor]
[...continue em ordem decrescente...]
Total mensal: R$ [soma total]
Isso inclui uma estimativa mensal dos gastos anuais. Está correto assim?"

PERGUNTAS DE AJUDA PARA ESTIMATIVA:
- Moradia: "Você mora de aluguel ou casa própria?"
- Alimentação: "Quantas vezes por semana faz compras no mercado? Quantas vezes come fora?"
- Transporte: "Você tem carro? Usa transporte público?"
- Saúde: "Tem plano de saúde? Toma algum remédio regular?"
- Educação: "Faz algum curso? Tem filhos na escola?"
- Lazer: "Tem Netflix, Spotify? Sai para bares/cinema?"
- Vestuário: "Com que frequência compra roupas?"
- Gastos eventuais: "Faz viagens por ano? Tem seguro do carro?"

ESTILO DE CONVERSAÇÃO:
- Máximo 2 frases por resposta
- 1 emoji por mensagem
- Linguagem simples e calorosa
- SEMPRE confirme valores antes de seguir

LEMBRE-SE: UMA pergunta por vez, AJUDE a estimar, descubra TODAS as 8 categorias!`
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
        temperature: 0.1, // Very low for strict rule following
        max_tokens: 200, // Even more concise responses
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