const OpenAI = require('openai');

class ConversationSupervisor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Main supervisor that orchestrates all supervision checks
   */
  async superviseConversation(currentState, messageHistory, proposedResponse, context) {
    try {
      console.log(`🎯 Supervising conversation in state: ${currentState}`);
      
      // Run all supervision checks in parallel
      const [
        transitionCheck,
        convergenceCheck,
        contextCheck
      ] = await Promise.all([
        this.checkStateTransition(currentState, messageHistory, proposedResponse, context),
        this.checkConvergence(currentState, messageHistory, proposedResponse, context),
        this.checkContextPreservation(currentState, messageHistory, proposedResponse, context)
      ]);

      // Combine all supervision results
      const supervisionResult = {
        approved: transitionCheck.approved && convergenceCheck.approved && contextCheck.approved,
        corrections: [],
        revisedResponse: proposedResponse
      };

      // Collect all corrections
      if (!transitionCheck.approved) {
        supervisionResult.corrections.push(transitionCheck.correction);
      }
      if (!convergenceCheck.approved) {
        supervisionResult.corrections.push(convergenceCheck.correction);
      }
      if (!contextCheck.approved) {
        supervisionResult.corrections.push(contextCheck.correction);
      }

      // If corrections needed, generate revised response
      if (!supervisionResult.approved) {
        supervisionResult.revisedResponse = await this.generateRevisedResponse(
          currentState,
          messageHistory,
          proposedResponse,
          supervisionResult.corrections,
          context
        );
      }

      return supervisionResult;

    } catch (error) {
      console.error('❌ Supervision error:', error);
      // If supervision fails, allow the original response
      return {
        approved: true,
        corrections: [],
        revisedResponse: proposedResponse
      };
    }
  }

  /**
   * State Transition Supervisor - ensures state requirements are met before transitioning
   */
  async checkStateTransition(currentState, messageHistory, proposedResponse, context) {
    const prompt = `
    You are a State Transition Supervisor for a financial advisor chatbot.
    
    Current State: ${currentState}
    Context: ${JSON.stringify(context)}
    Last User Message: "${messageHistory[messageHistory.length - 1]?.user || ''}"
    Proposed Bot Response: "${proposedResponse}"
    
    CRITICAL: Look for these SPECIFIC violations:
    
    In GOAL_DISCOVERY or GOAL_CLARIFICATION states, REJECT if response contains:
    - "renda mensal" or "quanto ganha"
    - "gastos fixos" or "despesas"
    - "orçamento" or "budget"
    - Income/expense tracking language
    
    APPROVE if response focuses on:
    - Goal specifics (what, how much, when)
    - Clarifying the objective
    - Understanding the target
    
    Examples:
    ❌ REJECT: "Qual sua renda mensal?" (premature income question)
    ❌ REJECT: "Quais são seus gastos?" (premature expense tracking)
    ✅ APPROVE: "Que tipo de carro você quer?" (goal clarification)
    ✅ APPROVE: "Quanto você quer economizar?" (goal amount)
    
    Respond in JSON:
    {
      "approved": true/false,
      "premature_transition": true/false,
      "correction": "Stay focused on goal definition. Don't ask about income/expenses yet."
    }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('State transition check error:', error);
      return { approved: true };
    }
  }

  /**
   * Convergence Supervisor - ensures conversation stays focused on current objective
   */
  async checkConvergence(currentState, messageHistory, proposedResponse, context) {
    const prompt = `
    You are a Convergence Supervisor ensuring conversations stay focused.
    
    Current State: ${currentState}
    Current Objective: ${this.getStateObjective(currentState)}
    Proposed Response: "${proposedResponse}"
    
    SPECIFIC DRIFT PATTERNS TO CATCH:
    
    ❌ DRIFTING if response contains:
    - "gastos", "despesas", "quanto gasta" (expense tracking too early)
    - "renda", "salário", "quanto ganha" (income questions too early)
    - "orçamento", "planejamento financeiro" (budget creation too early)
    - Multiple unrelated topics in one response
    
    ✅ FOCUSED if response:
    - Asks about goal specifics (type, amount, timeline)
    - Clarifies the user's objective
    - Stays on the current state's objective
    
    Examples:
    ❌ DRIFT: "Vamos ver quanto você gasta com alimentação" (expense focus)
    ❌ DRIFT: "Vou criar um orçamento para você" (premature planning)
    ✅ FOCUSED: "Quanto você quer economizar por mês?" (goal amount)
    ✅ FOCUSED: "Para quando você quer esse carro?" (goal timeline)
    
    Respond in JSON:
    {
      "approved": true/false,
      "is_drifting": true/false,
      "drift_topic": "expenses|income|budget|other",
      "correction": "Focus on goal definition. Don't discuss expenses/income yet."
    }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Convergence check error:', error);
      return { approved: true };
    }
  }

  /**
   * Context Preservation Supervisor - ensures important context isn't lost
   */
  async checkContextPreservation(currentState, messageHistory, proposedResponse, context) {
    const prompt = `
    You are a Context Preservation Supervisor.
    
    Current State: ${currentState}
    Context: ${JSON.stringify(context)}
    User's Goal Info: ${JSON.stringify(context.partial_goal)}
    Proposed Response: "${proposedResponse}"
    
    CHECK FOR CONTEXT VIOLATIONS:
    
    ❌ REJECT if:
    - Asking for goal type when already known (context.partial_goal.goal_type exists)
    - Asking for amount when already provided (context.partial_goal.amount exists)
    - Asking for timeline when already given (context.partial_goal.timeline exists)
    - Forgetting the user's specific item/objective
    - Generic "what do you want" when goal partially defined
    
    ✅ APPROVE if:
    - Building on known information
    - Asking for missing pieces only
    - Referencing their stated goal appropriately
    
    Examples:
    ❌ REJECT: "O que você quer fazer?" when goal_type is already savings
    ❌ REJECT: "Quanto você quer economizar?" when amount is already R$1000
    ✅ APPROVE: "Para sua aposentadoria, quando você quer atingir essa meta?"
    
    Respond in JSON:
    {
      "approved": true/false,
      "context_preserved": true/false,
      "forgotten_info": "specific information that was forgotten",
      "correction": "Remember the user wants [specific goal]. Ask about [missing piece] instead."
    }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Context preservation check error:', error);
      return { approved: true };
    }
  }

  /**
   * Generate a revised response based on supervisor corrections
   */
  async generateRevisedResponse(currentState, messageHistory, originalResponse, corrections, context) {
    const prompt = `
    You are Arnaldo revising your response based on supervisor feedback.
    
    Current State: ${currentState}
    Original Response: "${originalResponse}"
    
    Supervisor Corrections:
    ${corrections.map((c, i) => `${i + 1}. ${c}`).join('\n')}
    
    Context: ${JSON.stringify(context)}
    
    Generate a revised response that:
    1. Addresses all supervisor corrections
    2. Stays warm, friendly, and conversational
    3. Focuses on the current objective: ${this.getStateObjective(currentState)}
    4. Is concise (under 4 lines)
    
    Respond in Portuguese as Arnaldo would.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Revised response generation error:', error);
      return originalResponse; // Fallback to original
    }
  }

  /**
   * Get the primary objective for each state
   */
  getStateObjective(state) {
    const objectives = {
      'GOAL_DISCOVERY': 'Identify what type of financial goal the user has',
      'GOAL_CLARIFICATION': 'Collect specific details: item/objective, amount, and timeline',
      'GOAL_COMPLETE': 'Confirm goal and transition to income collection',
      'INCOME_COLLECTION': 'Collect monthly income amount',
      'EXPENSE_TRACKING': 'Track user expenses',
      'PLAN_CREATION': 'Create personalized financial plan'
    };

    return objectives[state] || 'Progress the conversation appropriately';
  }

  /**
   * Validate if state requirements are met
   */
  validateStateRequirements(state, context) {
    switch (state) {
      case 'GOAL_CLARIFICATION':
        const goal = context.partial_goal || {};
        return {
          hasType: !!goal.goal_type,
          hasSpecifics: !!goal.item || !!goal.objective,
          hasAmount: !!goal.amount,
          hasTimeline: !!goal.timeline,
          isComplete: goal.goal_type && (goal.item || goal.objective) && goal.amount && goal.timeline
        };
      
      case 'INCOME_COLLECTION':
        return {
          hasIncome: !!context.monthly_income,
          isComplete: !!context.monthly_income
        };
      
      default:
        return { isComplete: false };
    }
  }

  /**
   * Analyze conversation flow for patterns
   */
  analyzeFlowPattern(messageHistory) {
    // Detect common problematic patterns
    const patterns = {
      prematureExpenseDiscussion: false,
      repeatingQuestions: false,
      contextLoss: false,
      topicDrift: false
    };

    // Check for premature expense discussion
    const recentMessages = messageHistory.slice(-5);
    const hasExpenseKeywords = recentMessages.some(msg => 
      msg.assistant && (
        msg.assistant.includes('gastos') || 
        msg.assistant.includes('despesas') ||
        msg.assistant.includes('quanto gasta')
      )
    );

    const hasIncompleteGoal = !messageHistory.some(msg => 
      msg.assistant && msg.assistant.includes('OBJETIVO DEFINIDO')
    );

    if (hasExpenseKeywords && hasIncompleteGoal) {
      patterns.prematureExpenseDiscussion = true;
    }

    return patterns;
  }

  /**
   * Get supervision statistics for monitoring
   */
  getSupervisionStats() {
    // This could be extended to track supervision interventions
    return {
      totalChecks: 0,
      interventions: 0,
      commonCorrections: []
    };
  }
}

module.exports = ConversationSupervisor;