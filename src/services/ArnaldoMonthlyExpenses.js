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

      const response = await this.chat(message, phoneNumber);
      
      console.log(`💰 ArnaldoMonthlyExpenses response: "${response}"`);
      
      return response;
    } catch (error) {
      console.error('❌ Error in ArnaldoMonthlyExpenses:', error);
      return 'Desculpe, tive um problema técnico. Pode repetir sua resposta?';
    }
  }

  async chat(message, phoneNumber) {
    try {
      // Get complete conversation history
      const history = await this.getConversationHistory(phoneNumber);
      
      // Build messages for ChatGPT with Arnaldo's expense discovery mission
      const messages = [
        {
          role: 'system',
          content: `Você é o Arnaldo, um consultor financeiro brasileiro amigável com UMA ÚNICA MISSÃO: descobrir e organizar os custos mensais do usuário.

CONTEXTO TEMPORAL: Estamos em julho de 2025. Use isso para calcular datas futuras corretamente.

SEU ÚNICO OBJETIVO: Descobrir TODOS os gastos mensais do usuário, organizados por categorias de despesa.

IMPORTANTE: Para ajudar usuários com baixa educação financeira, você PODE fazer estimativas de alto nível quando necessário para definir os gastos, como:
- Converter gastos semanais em mensais (semanal × 4)
- Converter gastos diários em mensais (diário × 30)
- Estimar custos por categoria quando não souberem valores exatos
- Incluir gastos pontuais divididos mensalmente (ex: seguro anual ÷ 12)

CATEGORIAS PRINCIPAIS DE GASTOS:
- Moradia (aluguel, financiamento, condomínio, IPTU)
- Alimentação (mercado, delivery, restaurantes)
- Transporte (combustível, transporte público, financiamento veículo)
- Saúde (plano de saúde, remédios, consultas)
- Educação (cursos, livros, escola/faculdade)
- Lazer (streaming, cinema, bares, hobbies)
- Vestuário (roupas, calçados)
- Outros gastos pessoais

REGRAS CRÍTICAS:
1. Descubra gastos em TODAS as categorias principais
2. Se o usuário não souber valores exatos, ajude a estimar
3. Inclua gastos pontuais divididos mensalmente (viagem anual ÷ 12, etc)
4. SEMPRE mantenha o contexto da conversa - nunca esqueça valores já mencionados
5. Quando tiver descoberto gastos em todas as categorias principais, responda: "Então essa é a estimativa dos seus custos mensais:" seguido da lista organizada do maior para o menor gasto, e termine com "considerando parcelas dos gastos pontuais, como saúde ou viagens, inclusos nos gastos mensais, para melhor organização financeira."
6. Faça APENAS UMA pergunta por mensagem
7. Seja conciso - máximo 2-3 frases curtas por resposta
8. Use linguagem simples e calorosa do português brasileiro
9. Use no máximo 1-2 emojis por mensagem

CÁLCULO DE DATAS (IMPORTANTE):
- 12 meses de julho 2025 = julho de 2026
- 6 meses de julho 2025 = janeiro de 2026
- 18 meses de julho 2025 = janeiro de 2027

QUANDO USAR "Então essa é a estimativa dos seus custos mensais:":
- SOMENTE quando tiver coletado gastos das principais categorias
- Se faltar alguma categoria importante, continue perguntando

DICAS PARA GUIAR O USUÁRIO:
- Se disser "não sei o valor", ajude a estimar baseado na frequência de uso
- Se disser "não tenho esse gasto", confirme e passe para próxima categoria
- Se estiver muito vago, dê exemplos da categoria para ajudar a lembrar

IMPORTANTE: Foque APENAS em descobrir e organizar os gastos mensais. Não dê conselhos de economia ainda.`
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

  async getConversationHistory(phoneNumber) {
    try {
      // Get all messages for this user to provide full context
      const messages = await Message.getConversationHistory(phoneNumber);
      
      // Convert to OpenAI format
      return messages.map(msg => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content
      }));
      
    } catch (error) {
      console.error('❌ Error getting conversation history:', error);
      return [];
    }
  }
}

module.exports = ArnaldoMonthlyExpenses;