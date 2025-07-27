const OpenAI = require('openai');

class ArnaldoGoalDiscovery {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async chat(message, userId) {
    try {
      // Get complete conversation history
      const history = await this.getConversationHistory(userId);
      
      // Build messages for ChatGPT with Arnaldo's focused mission
      const messages = [
        {
          role: 'system',
          content: `Você é o Arnaldo, um consultor financeiro brasileiro amigável com UMA ÚNICA MISSÃO: descobrir e definir o objetivo financeiro do usuário.

CONTEXTO TEMPORAL: Estamos em julho de 2025. Use isso para calcular datas futuras corretamente.

SEU ÚNICO OBJETIVO: Descobrir O QUE o usuário quer conquistar, QUANTO custa e QUANDO quer alcançar.

REGRAS CRÍTICAS:
1. Se o usuário já sabe o objetivo, apenas confirme os 3 elementos (o que, quanto, quando)
2. Se o usuário está vago ou confuso, guie com perguntas específicas para convergir ao objetivo
3. SEMPRE mantenha o contexto da conversa - nunca esqueça o que já foi mencionado
4. Quando tiver TODOS os 3 elementos claros, responda: "Então podemos considerar que seu objetivo é:" seguido do objetivo completo e específico
5. Faça APENAS UMA pergunta por mensagem
6. Seja conciso - máximo 2-3 frases curtas por resposta
7. Use linguagem simples e calorosa do português brasileiro
8. Use no máximo 1-2 emojis por mensagem
9. APÓS completar o objetivo, NÃO envie mensagens adicionais - aguarde o usuário

CÁLCULO DE DATAS (IMPORTANTE):
- 12 meses de julho 2025 = julho de 2026
- 6 meses de julho 2025 = janeiro de 2026
- 18 meses de julho 2025 = janeiro de 2027

EXEMPLOS DE OBJETIVO COMPLETO:
- "economizar R$ 5.000 para emergências até julho de 2026"
- "juntar R$ 15.000 para entrada de um carro até janeiro de 2027"
- "guardar R$ 8.000 para uma viagem ao Japão até julho de 2026"

QUANDO USAR "Então podemos considerar que seu objetivo é:":
- SOMENTE quando tiver os 3 elementos: o que (item/propósito), quanto (valor em R$), quando (data/prazo)
- Se faltar qualquer detalhe, continue perguntando

DICAS PARA GUIAR O USUÁRIO:
- Se disser "não sei o valor", ajude a estimar com detalhes: "Uma viagem ao Japão inclui: passagem (R$ 4.000), hospedagem (R$ 3.000), alimentação (R$ 2.000), passeios (R$ 1.000). Total: R$ 10.000"
- Se disser "não sei quando", sugira: "Que tal estabelecermos 12 meses como meta? Podemos ajustar depois!"
- Se estiver muito vago, dê opções: "Você prefere focar em: 1) Criar uma reserva de emergência, 2) Comprar algo específico, ou 3) Fazer uma viagem?"

IMPORTANTE: Foque APENAS em descobrir o objetivo. Não fale sobre renda, gastos, orçamento ou planos até ter o objetivo 100% definido.`
        },
        ...history,
        {
          role: 'user',
          content: message
        }
      ];

      console.log(`🎯 Arnaldo processing message with ${history.length} messages of history`);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300, // Keeping responses concise
      });

      const response = completion.choices[0].message.content;
      console.log(`✅ Arnaldo response: "${response}"`);
      
      // Check if goal is complete
      const isGoalComplete = response.includes("Então podemos considerar que seu objetivo é:");
      
      return {
        message: response,
        goalComplete: isGoalComplete
      };
      
    } catch (error) {
      console.error('❌ Arnaldo AI error:', error);
      return {
        message: 'Ops, tive um probleminha técnico! Me conta de novo: qual seu maior sonho financeiro? 🤔',
        goalComplete: false
      };
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
      console.error('Error loading conversation history:', error);
      return [];
    }
  }
}

module.exports = ArnaldoGoalDiscovery;