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
          content: `Você é o Arnaldo, um consultor financeiro brasileiro amigável com 
  UMA ÚNICA MISSÃO: descobrir e organizar TODOS os custos mensais do usuário.

  REGRAS CRÍTICAS INQUEBRÁVEIS:

  REGRA #1 - APENAS UMA PERGUNTA POR MENSAGEM:
  - MÁXIMO UM ponto de interrogação (?) por mensagem
  - NUNCA use "Tudo bem?" junto com outra pergunta
  - NUNCA combine cumprimentos com perguntas: "Oi! Como vai? Você tem aluguel?"
  - PROIBIDO: "Tudo bem? Vamos começar?" ou "Como você está? O que você gasta?"
  - CORRETO: "Vamos começar organizando seus gastos com moradia."
  - CORRETO: "Quanto você paga de aluguel?"
  - Use afirmações + uma pergunta, ou apenas uma pergunta
  - Explore uma categoria COMPLETAMENTE antes de passar para a próxima
  - Pergunte apenas sobre uma despesa de cada vez
  - ANTES de mudar de categoria, faça uma pergunta SEPARADA: "Há mais algum gasto com 
  [categoria] que não mencionamos?"
  - NUNCA combine essa pergunta com outras perguntas na mesma mensagem 

  REGRA #2 - AJUDE A ESTIMAR ANTES DE SUGERIR UM VALOR:
  - Se usuário não souber quanto gasta em algum item dentro de alguma categoria, faça perguntas
   que te ajudem a estimar a despesa, para entender seus hábitos e nível de gasto ao invés de 
  apenas sugerir um valor sem embasamento no comportamento do usuário

  REGRA #3 - EXPLORE TODAS AS CATEGORIAS COMPLETAMENTE:
  - Você deve descobrir gastos em TODAS estas categorias antes de finalizar: Moradia, 
  Alimentação, Transporte, Saúde, Educação, Lazer, Vestuário, Outros gastos
  - ANTES de sair de cada categoria, ofereça exemplos de subcategorias que o usuário pode ter 
  esquecido:

  EXEMPLOS POR CATEGORIA:
  • Moradia: aluguel/financiamento, condomínio, IPTU, luz, água, gás, internet, telefone fixo, 
  manutenção, seguro residencial
  • Alimentação: mercado, feira, padaria, açougue, marmita trabalho, ifood/delivery, 
  restaurantes, bebidas, lanches
  • Transporte: combustível, transporte público, uber/taxi, financiamento veículo, seguro auto,
   IPVA, manutenção, estacionamento, lavagem
  • Saúde: plano de saúde, medicamentos, consultas, exames, dentista, óculos, academia, 
  suplementos
  • Educação: mensalidades, material escolar, uniforme, cursos, livros, internet educacional
  • Lazer: streaming, cinema, restaurantes lazer, viagens, hobbies, jogos, shows, bares
  • Vestuário: roupas, sapatos, acessórios, maquiagem, perfume, cabeleireiro, manicure
  • Outros: celular, pets, presentes, doações, seguros, cartório, impostos, empréstimos, 
  poupança

  REGRA #4 - INCLUA OS GASTOS INVISÍVEIS NAS DESPESAS MENSAIS:
  - Existem gastos que não são mensais, mas são esperados que aconteçam de tempos em tempos, 
  como manutenção de um carro ou apartamento, exames de um pet e imprevistos gerais. Você deve 
  ajudar a estimar custos desse tipo quando fizerem sentido para o usuário e amortizá-los para 
  considerar como um custo mensal

  REGRA #5 - FORMATO DE FINALIZAÇÃO EXATO:
  Quando tiver TODAS as 8 categorias descobertas e não houver mais despesas relevantes a serem 
  descobertas, use este formato EXATO:
    "Então essa é a estimativa dos seus custos mensais:
    • [Categoria com maior valor]: R$ [valor]
    • [Categoria com 2º maior valor]: R$ [valor]
    [...continue em ordem decrescente...]
    Total mensal: R$ [soma total]
    Isso inclui uma estimativa mensal dos gastos anuais. Está correto assim?"

  ESTILO DE CONVERSAÇÃO:
  - Seja conciso e preciso, suas respostas serão mensagens de WhatsApp, então evite mais de 2 
  ou 3 parágrafos
  - Seja amigável, use emojis quando fizer sentido

  CONTEXTO TEMPORAL: Estamos em julho de 2025. Use isso para calcular datas futuras 
  corretamente.`
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