const db = require('../database/db');

class ConversationMemory {
  constructor() {
    this.maxMessages = 40; // Keep last 40 messages for context
    this.maxTokens = 4000; // Reserve tokens for context
  }

  /**
   * Load comprehensive conversation context for AI
   */
  async loadConversationContext(userId) {
    try {
      console.log(`📚 Loading conversation context for user ${userId}`);
      
      // Load parallel data for efficiency
      const [
        conversationHistory,
        userProfile,
        userGoals,
        currentState,
        recentExpenses
      ] = await Promise.all([
        this.loadConversationHistory(userId),
        this.loadUserProfile(userId),
        this.loadUserGoals(userId),
        this.loadCurrentState(userId),
        this.loadRecentExpenses(userId)
      ]);

      // Build comprehensive context
      const context = {
        conversationHistory,
        userProfile,
        userGoals,
        currentState,
        recentExpenses,
        summary: this.generateContextSummary({
          userProfile,
          userGoals,
          currentState
        })
      };

      console.log(`✅ Context loaded: ${conversationHistory.length} messages, ${userGoals.length} goals`);
      
      return context;
      
    } catch (error) {
      console.error('❌ Error loading conversation context:', error);
      return this.getEmptyContext();
    }
  }

  /**
   * Load recent conversation history
   */
  async loadConversationHistory(userId) {
    try {
      const query = `
        SELECT 
          m.id,
          m.direction,
          m.content,
          m.created_at,
          m.message_type
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `;
      
      const result = await db.query(query, [userId, this.maxMessages]);
      
      // Reverse to get chronological order
      return result.rows.reverse().map(msg => {
        // Parse content if it's a JSON string
        let messageContent = msg.content;
        try {
          const parsed = JSON.parse(msg.content);
          messageContent = parsed.text || parsed.body || msg.content;
        } catch (e) {
          // If not JSON, use as is
        }
        
        return {
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: messageContent,
          timestamp: msg.created_at,
          type: msg.message_type
        };
      });
      
    } catch (error) {
      console.error('Error loading conversation history:', error);
      return [];
    }
  }

  /**
   * Load user profile with financial information
   */
  async loadUserProfile(userId) {
    try {
      const query = `
        SELECT 
          u.id,
          u.phone_number,
          u.name,
          u.monthly_income,
          u.onboarding_completed,
          u.created_at,
          u.preferences,
          us.current_state,
          us.context as state_context
        FROM users u
        LEFT JOIN user_states us ON u.id = us.user_id
        WHERE u.id = $1
      `;
      
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      
      return {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name,
        monthlyIncome: user.monthly_income,
        onboardingCompleted: user.onboarding_completed,
        memberSince: user.created_at,
        currentState: user.current_state,
        stateContext: user.state_context,
        preferences: user.preferences || {}
      };
      
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  /**
   * Load user's financial goals
   */
  async loadUserGoals(userId) {
    try {
      const query = `
        SELECT 
          id,
          type,
          name,
          target_amount,
          current_amount,
          target_date,
          status,
          created_at,
          description
        FROM goals
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      const result = await db.query(query, [userId]);
      
      return result.rows.map(goal => ({
        id: goal.id,
        type: goal.type,
        name: goal.name,
        targetAmount: goal.target_amount,
        currentAmount: goal.current_amount,
        targetDate: goal.target_date,
        status: goal.status,
        createdAt: goal.created_at,
        description: goal.description ? JSON.parse(goal.description) : {}
      }));
      
    } catch (error) {
      console.error('Error loading user goals:', error);
      return [];
    }
  }

  /**
   * Load current conversation state
   */
  async loadCurrentState(userId) {
    try {
      const query = `
        SELECT 
          current_state,
          previous_state,
          context,
          updated_at
        FROM user_states
        WHERE user_id = $1
      `;
      
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return { state: 'new_user', context: {} };
      }
      
      const state = result.rows[0];
      
      return {
        currentState: state.current_state,
        previousState: state.previous_state,
        context: state.context || {},
        lastUpdated: state.updated_at
      };
      
    } catch (error) {
      console.error('Error loading current state:', error);
      return { state: 'new_user', context: {} };
    }
  }

  /**
   * Load recent expenses for context
   */
  async loadRecentExpenses(userId, days = 7) {
    try {
      const query = `
        SELECT 
          amount,
          category,
          description,
          expense_date
        FROM expenses
        WHERE user_id = $1
          AND expense_date >= NOW() - INTERVAL '${days} days'
        ORDER BY expense_date DESC
        LIMIT 20
      `;
      
      const result = await db.query(query, [userId]);
      
      // Calculate summary
      const totalExpenses = result.rows.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      const categorySummary = {};
      
      result.rows.forEach(exp => {
        if (!categorySummary[exp.category]) {
          categorySummary[exp.category] = 0;
        }
        categorySummary[exp.category] += parseFloat(exp.amount);
      });
      
      return {
        recent: result.rows.slice(0, 5), // Last 5 expenses
        totalLastWeek: totalExpenses,
        byCategory: categorySummary,
        count: result.rows.length
      };
      
    } catch (error) {
      console.error('Error loading recent expenses:', error);
      return {
        recent: [],
        totalLastWeek: 0,
        byCategory: {},
        count: 0
      };
    }
  }

  /**
   * Generate a summary of context for AI
   */
  generateContextSummary({ userProfile, userGoals, currentState }) {
    const parts = [];
    
    if (userProfile) {
      parts.push(`User: ${userProfile.name || 'Not set'}`);
      if (userProfile.monthlyIncome) {
        parts.push(`Income: R$${userProfile.monthlyIncome}/month`);
      }
      parts.push(`State: ${userProfile.currentState || 'new'}`);
    }
    
    if (userGoals && userGoals.length > 0) {
      const activeGoal = userGoals.find(g => g.status === 'active') || userGoals[0];
      parts.push(`Active Goal: ${activeGoal.name} (R$${activeGoal.targetAmount})`);
    }
    
    return parts.join(' | ');
  }

  /**
   * Format context for AI consumption
   */
  formatForAI(context) {
    const formatted = {
      conversationHistory: context.conversationHistory.slice(-30), // Last 30 messages
      userSummary: this.formatUserSummary(context.userProfile),
      goals: this.formatGoals(context.userGoals),
      currentPhase: context.currentState,
      recentActivity: this.formatRecentActivity(context.recentExpenses)
    };
    
    return formatted;
  }

  formatUserSummary(profile) {
    if (!profile) return "New user, no profile yet";
    
    return [
      `Name: ${profile.name || 'Not provided'}`,
      profile.monthlyIncome ? `Monthly Income: R$${profile.monthlyIncome}` : 'Income not set',
      `Member since: ${new Date(profile.memberSince).toLocaleDateString('pt-BR')}`,
      `Current state: ${profile.currentState}`
    ].join('\n');
  }

  formatGoals(goals) {
    if (!goals || goals.length === 0) return "No goals set yet";
    
    return goals.map(goal => 
      `${goal.name}: R$${goal.currentAmount || 0}/${goal.targetAmount} (${goal.status})`
    ).join('\n');
  }

  formatRecentActivity(expenses) {
    if (!expenses || expenses.count === 0) return "No recent expenses";
    
    return [
      `Last week: R$${expenses.totalLastWeek.toFixed(2)} in ${expenses.count} expenses`,
      `Top categories: ${Object.entries(expenses.byCategory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([cat, amount]) => `${cat} (R$${amount.toFixed(2)})`)
        .join(', ')}`
    ].join('\n');
  }

  /**
   * Get empty context structure
   */
  getEmptyContext() {
    return {
      conversationHistory: [],
      userProfile: null,
      userGoals: [],
      currentState: { state: 'new_user', context: {} },
      recentExpenses: {
        recent: [],
        totalLastWeek: 0,
        byCategory: {},
        count: 0
      },
      summary: 'New conversation'
    };
  }

  /**
   * Save message to conversation history
   */
  async saveMessage(conversationId, sender, content, messageType = 'text') {
    try {
      const query = `
        INSERT INTO messages (conversation_id, sender, content, message_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      
      const result = await db.query(query, [
        conversationId,
        sender,
        content,
        messageType
      ]);
      
      console.log(`💾 Message saved: ${sender} - ${content.substring(0, 50)}...`);
      return result.rows[0].id;
      
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }
}

module.exports = ConversationMemory;