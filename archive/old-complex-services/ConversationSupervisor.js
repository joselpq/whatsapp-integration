const OpenAI = require('openai');

class ConversationSupervisor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate conversation guidelines based on current state
   * This runs BEFORE AI generates response, not after
   */
  async getConversationGuidelines(currentState, context, conversationHistory) {
    try {
      console.log(`🎯 Generating guidelines for state: ${currentState}`);
      
      const guidelines = {
        state: currentState,
        objective: this.getStateObjective(currentState),
        allowedTopics: this.getAllowedTopics(currentState),
        forbiddenTopics: this.getForbiddenTopics(currentState),
        requiredInfo: this.getRequiredInfo(currentState, context),
        contextualRules: await this.generateContextualRules(currentState, context, conversationHistory),
        suggestedFlow: this.getSuggestedFlow(currentState, context)
      };

      console.log(`✅ Guidelines generated:`, {
        objective: guidelines.objective,
        forbiddenCount: guidelines.forbiddenTopics.length,
        requiredCount: Object.keys(guidelines.requiredInfo).length
      });
      
      return guidelines;
      
    } catch (error) {
      console.error('❌ Error generating guidelines:', error);
      return this.getDefaultGuidelines(currentState);
    }
  }

  /**
   * Get the primary objective for each state
   */
  getStateObjective(state) {
    const objectives = {
      'NEW_USER': 'Welcome user warmly and transition to goal discovery',
      'GOAL_DISCOVERY': 'Understand what financial goal the user wants to achieve',
      'GOAL_CLARIFICATION': 'Collect missing details: specific item/objective, target amount, and timeline',
      'GOAL_COMPLETE': 'Confirm the complete goal and transition to income collection',
      'INCOME_COLLECTION': 'Collect monthly income information',
      'EXPENSE_TRACKING': 'Track and categorize user expenses',
      'PLAN_CREATION': 'Create personalized financial plan based on income and goals',
      'ACTIVE_TRACKING': 'Provide ongoing support and track progress'
    };

    return objectives[state] || 'Guide the user appropriately';
  }

  /**
   * Define allowed topics for each state
   */
  getAllowedTopics(state) {
    const topicsMap = {
      'NEW_USER': ['welcome', 'introduction', 'goals overview'],
      'GOAL_DISCOVERY': ['goal types', 'dreams', 'financial objectives', 'priorities'],
      'GOAL_CLARIFICATION': ['goal specifics', 'amounts', 'timelines', 'details'],
      'GOAL_COMPLETE': ['goal confirmation', 'next steps introduction'],
      'INCOME_COLLECTION': ['monthly income', 'salary', 'extra income', 'income sources'],
      'EXPENSE_TRACKING': ['expenses', 'spending', 'budget categories', 'fixed costs'],
      'PLAN_CREATION': ['savings plan', 'budget allocation', 'recommendations'],
      'ACTIVE_TRACKING': ['progress', 'adjustments', 'tips', 'motivation']
    };

    return topicsMap[state] || [];
  }

  /**
   * Define forbidden topics for each state
   */
  getForbiddenTopics(state) {
    const forbiddenMap = {
      'NEW_USER': ['income', 'expenses', 'detailed planning'],
      'GOAL_DISCOVERY': ['income', 'expenses', 'budget', 'spending analysis'],
      'GOAL_CLARIFICATION': ['income', 'expenses', 'budget', 'spending patterns'],
      'GOAL_COMPLETE': ['expenses', 'detailed budget'],
      'INCOME_COLLECTION': ['detailed expenses', 'budget analysis'],
      'EXPENSE_TRACKING': [],
      'PLAN_CREATION': [],
      'ACTIVE_TRACKING': []
    };

    return forbiddenMap[state] || [];
  }

  /**
   * Get required information for current state
   */
  getRequiredInfo(state, context) {
    const requirements = {};
    
    if (state === 'GOAL_CLARIFICATION') {
      const goal = context.partial_goal || {};
      
      if (!goal.goal_type) requirements.goal_type = 'Type of financial goal';
      if (!goal.item && !goal.objective) requirements.specifics = 'Specific item or objective';
      if (!goal.amount) requirements.amount = 'Target amount in reais';
      if (!goal.timeline) requirements.timeline = 'When they want to achieve it';
    }
    
    if (state === 'INCOME_COLLECTION') {
      if (!context.monthly_income) requirements.income = 'Monthly income amount';
    }
    
    return requirements;
  }

  /**
   * Generate contextual rules based on conversation history
   */
  async generateContextualRules(state, context, conversationHistory) {
    // Simple rules without AI for now
    const rules = [];
    
    // Check for repeated questions
    if (conversationHistory && conversationHistory.length > 5) {
      const lastMessages = conversationHistory.slice(-5);
      const hasRepeatedTopics = this.detectRepeatedTopics(lastMessages);
      
      if (hasRepeatedTopics) {
        rules.push('Avoid repeating questions already answered');
      }
    }
    
    // Check conversation flow
    if (state === 'GOAL_CLARIFICATION' && context.partial_goal) {
      rules.push(`Build on known information: ${JSON.stringify(context.partial_goal)}`);
      rules.push('Ask only for missing pieces, not what you already know');
    }
    
    // Add warmth rules
    rules.push('Maintain warm, empathetic tone');
    rules.push('Use simple language, avoid jargon');
    
    return rules;
  }

  /**
   * Suggest conversation flow for current state
   */
  getSuggestedFlow(state, context) {
    const flows = {
      'GOAL_DISCOVERY': [
        'Acknowledge their message',
        'Ask clarifying question about goal type',
        'Show enthusiasm and support'
      ],
      'GOAL_CLARIFICATION': [
        'Acknowledge progress made',
        'Ask for ONE missing piece of information',
        'Keep it conversational and natural'
      ],
      'GOAL_COMPLETE': [
        'Celebrate the defined goal',
        'Summarize what was defined',
        'Transition to income collection'
      ],
      'INCOME_COLLECTION': [
        'Explain why income info helps',
        'Ask for monthly income',
        'Assure privacy and security'
      ]
    };
    
    return flows[state] || ['Respond appropriately to user'];
  }

  /**
   * Build comprehensive prompt addon for AI
   */
  buildGuidelinesPrompt(guidelines) {
    return `
CONVERSATION GUIDELINES FOR CURRENT STATE (${guidelines.state}):

PRIMARY OBJECTIVE: ${guidelines.objective}

ALLOWED TOPICS:
${guidelines.allowedTopics.map(t => `- ${t}`).join('\n')}

FORBIDDEN TOPICS (DO NOT DISCUSS):
${guidelines.forbiddenTopics.map(t => `- ❌ ${t}`).join('\n')}

INFORMATION NEEDED:
${Object.entries(guidelines.requiredInfo).map(([key, desc]) => `- ${key}: ${desc}`).join('\n') || '- All required information collected'}

CONTEXTUAL RULES:
${guidelines.contextualRules.map(r => `- ${r}`).join('\n')}

SUGGESTED CONVERSATION FLOW:
${guidelines.suggestedFlow.map((s, i) => `${i + 1}. ${s}`).join('\n')}

CRITICAL: Stay within these guidelines. Focus on the objective and avoid forbidden topics.
`;
  }

  /**
   * Validate if response follows guidelines (post-check)
   */
  async validateResponse(response, guidelines) {
    // Quick validation without AI
    const validation = {
      followsGuidelines: true,
      violations: []
    };
    
    // Check for forbidden topics
    const responseLower = response.toLowerCase();
    for (const forbidden of guidelines.forbiddenTopics) {
      if (forbidden === 'income' && (responseLower.includes('renda') || responseLower.includes('salário') || responseLower.includes('quanto ganha'))) {
        validation.followsGuidelines = false;
        validation.violations.push(`Mentioned forbidden topic: ${forbidden}`);
      }
      if (forbidden === 'expenses' && (responseLower.includes('gastos') || responseLower.includes('despesas'))) {
        validation.followsGuidelines = false;
        validation.violations.push(`Mentioned forbidden topic: ${forbidden}`);
      }
    }
    
    return validation;
  }

  /**
   * Detect repeated topics in conversation
   */
  detectRepeatedTopics(messages) {
    const topics = new Set();
    let hasRepeats = false;
    
    messages.forEach(msg => {
      if (msg.role === 'assistant') {
        const normalized = msg.content.toLowerCase();
        if (topics.has(normalized)) {
          hasRepeats = true;
        }
        topics.add(normalized);
      }
    });
    
    return hasRepeats;
  }

  /**
   * Get default guidelines if generation fails
   */
  getDefaultGuidelines(state) {
    return {
      state: state,
      objective: this.getStateObjective(state),
      allowedTopics: this.getAllowedTopics(state),
      forbiddenTopics: this.getForbiddenTopics(state),
      requiredInfo: {},
      contextualRules: ['Be helpful and empathetic', 'Stay focused on current objective'],
      suggestedFlow: ['Respond appropriately']
    };
  }

  /**
   * Legacy method - now just validates instead of correcting
   */
  async superviseConversation(currentState, messageHistory, proposedResponse, context) {
    // For backward compatibility - just approve everything
    // Real supervision happens BEFORE response generation now
    return {
      approved: true,
      corrections: [],
      revisedResponse: proposedResponse
    };
  }
}

module.exports = ConversationSupervisor;