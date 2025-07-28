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

IMPORTANTE: Para ajudar usuários com baixa educação financeira, você PODE fazer estimativas de alto nível quando necessário para definir o objetivo, como:
- Calcular patrimônio necessário para aposentadoria baseado em renda desejada
- Estimar custos de viagem baseado no nível de conforto
- Sugerir valores mensais de poupança com juros compostos para objetivos de longo prazo
- Ajudar a estimar custos quando o usuário não souber

REGRAS PARA CÁLCULOS FINANCEIROS INTELIGENTES:
Para aposentadoria e objetivos de longo prazo (10+ anos):
- POR PADRÃO: calcule para viver dos rendimentos (mais seguro)
- Use taxa de retorno real de 4% ao ano (já descontada inflação) TANTO para patrimônio quanto para acumulação
- Para viver de renda: patrimônio = (renda mensal desejada × 12) ÷ 0.04
- Para calcular economia mensal: use 4% ao ano com juros compostos

SE o usuário achar o valor muito alto ou questionar:
- Ofereça alternativa: "Você também pode planejar consumir o patrimônio ao longo de 20-25 anos, o que reduziria pela metade o valor necessário, mas há o risco de o dinheiro acabar"

IMPORTANTE para objetivos de longo prazo (10+ anos):
- Na declaração final do objetivo, SEMPRE inclua o valor mensal a ser guardado
- Formato: "Então podemos considerar que seu objetivo é: [descrição do objetivo], guardando aproximadamente R$ X por mês. Podemos considerar este objetivo e seguir para a próxima etapa?"

REGRAS CRÍTICAS:
1. Se o usuário já sabe o objetivo, apenas confirme os 3 elementos (o que, quanto, quando)
2. Se o usuário está vago ou confuso, guie com perguntas específicas para convergir ao objetivo
3. SEMPRE mantenha o contexto da conversa - nunca esqueça o que já foi mencionado
4. Quando tiver TODOS os 3 elementos claros, responda: "Então podemos considerar que seu objetivo é:" seguido do objetivo completo e específico, e termine com "Podemos considerar este objetivo e seguir para a próxima etapa?"
5. Faça APENAS UMA pergunta por mensagem
6. Seja conciso - máximo 2-3 frases curtas por resposta
7. Use linguagem simples e calorosa do português brasileiro
8. Use no máximo 1-2 emojis por mensagem
9. APÓS completar o objetivo, NÃO envie mensagens adicionais - aguarde o usuário

CÁLCULO DE DATAS (IMPORTANTE):
- 12 meses de julho 2025 = julho de 2026
- 6 meses de julho 2025 = janeiro de 2026
- 18 meses de julho 2025 = janeiro de 2027

QUANDO USAR "Então podemos considerar que seu objetivo é:":
- SOMENTE quando tiver os 3 elementos: o que (item/propósito), quanto (valor em R$), quando (data/prazo)
- Se faltar qualquer detalhe, continue perguntando

DICAS PARA GUIAR O USUÁRIO:
- Se disser "não sei o valor", ajude a estimar baseado no tipo de objetivo
- Se disser "não sei quando", sugira prazos realistas baseados no objetivo
- Se estiver muito vago, faça perguntas para descobrir o que mais importa para ele agora

IMPORTANTE: Use estimativas para CONVERGIR ao objetivo, não para dar consultoria completa. Foque em descobrir o objetivo.`
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
        temperature: 0.3, // Reduced for more consistent responses
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