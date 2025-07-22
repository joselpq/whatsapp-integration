const db = require('../database/db');

class ConversationState {
  // Conversation states
  static STATES = {
    NEW_USER: 'new_user',
    ONBOARDING_WELCOME: 'onboarding_welcome',
    GOAL_DISCOVERY: 'goal_discovery',
    INCOME_COLLECTION: 'income_collection',
    EXPENSE_ANALYSIS: 'expense_analysis',
    PLAN_CREATION: 'plan_creation',
    ACTIVE_TRACKING: 'active_tracking',
    EMERGENCY_MODE: 'emergency_mode'
  };

  // Onboarding steps
  static ONBOARDING_STEPS = {
    WELCOME: 'welcome',
    GOAL_SELECTION: 'goal_selection',
    INCOME_INPUT: 'income_input',
    EXPENSE_DISCOVERY: 'expense_discovery',
    PLAN_PRESENTATION: 'plan_presentation',
    ACTIVATION: 'activation'
  };

  static async getUserState(userId) {
    try {
      // Check if user has completed onboarding
      const userQuery = `
        SELECT 
          onboarding_completed,
          monthly_income,
          created_at
        FROM users 
        WHERE id = $1
      `;
      const userResult = await db.query(userQuery, [userId]);
      const user = userResult.rows[0];

      if (!user) {
        return this.STATES.NEW_USER;
      }

      // If just created (less than 5 minutes) and no onboarding
      const isNewUser = !user.onboarding_completed && 
        (Date.now() - new Date(user.created_at).getTime()) < 5 * 60 * 1000;

      if (isNewUser) {
        return this.STATES.ONBOARDING_WELCOME;
      }

      // Check for emergency keywords in recent messages
      const emergencyCheck = await this.checkEmergencyMode(userId);
      if (emergencyCheck) {
        return this.STATES.EMERGENCY_MODE;
      }

      // If onboarding not completed, continue onboarding
      if (!user.onboarding_completed) {
        return await this.getOnboardingStep(userId);
      }

      // Normal active user
      return this.STATES.ACTIVE_TRACKING;

    } catch (error) {
      console.error('Error getting user state:', error);
      return this.STATES.NEW_USER;
    }
  }

  static async getOnboardingStep(userId) {
    try {
      // Get user info to determine next step
      const userQuery = `
        SELECT 
          monthly_income,
          onboarding_completed
        FROM users 
        WHERE id = $1
      `;
      const userResult = await db.query(userQuery, [userId]);
      const user = userResult.rows[0];

      // Check if they have goals
      const goalsQuery = `
        SELECT COUNT(*) as goal_count 
        FROM goals 
        WHERE user_id = $1
      `;
      const goalsResult = await db.query(goalsQuery, [userId]);
      const hasGoals = parseInt(goalsResult.rows[0].goal_count) > 0;

      // Determine step based on what's missing
      if (!hasGoals) {
        return this.STATES.GOAL_DISCOVERY;
      } else if (!user.monthly_income) {
        return this.STATES.INCOME_COLLECTION;
      } else {
        return this.STATES.PLAN_CREATION;
      }

    } catch (error) {
      console.error('Error getting onboarding step:', error);
      return this.STATES.GOAL_DISCOVERY;
    }
  }

  static async checkEmergencyMode(userId) {
    try {
      // Check recent messages for emergency keywords
      const query = `
        SELECT m.content 
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1 
        AND m.direction = 'inbound'
        AND m.created_at > NOW() - INTERVAL '1 hour'
        ORDER BY m.created_at DESC
        LIMIT 3
      `;

      const result = await db.query(query, [userId]);
      const recentMessages = result.rows;

      const emergencyKeywords = [
        /acabou.*dinheiro/i,
        /sem.*dinheiro/i,
        /n[aã]o.*tenho.*dinheiro/i,
        /emergência/i,
        /emerg[eê]ncia/i,
        /desesperad[ao]/i,
        /ajuda.*urgent/i,
        /preciso.*urgent/i
      ];

      return recentMessages.some(msg => {
        const text = msg.content?.text || msg.content || '';
        return emergencyKeywords.some(pattern => pattern.test(text));
      });

    } catch (error) {
      console.error('Error checking emergency mode:', error);
      return false;
    }
  }

  static async updateUserState(userId, state, metadata = {}) {
    try {
      // Store state in user metadata or separate table
      const query = `
        UPDATE users 
        SET updated_at = NOW()
        WHERE id = $1
      `;
      await db.query(query, [userId]);

      // Log state transition for analytics
      const analyticsQuery = `
        INSERT INTO analytics_events (user_id, event_name, properties)
        VALUES ($1, 'state_transition', $2)
      `;
      await db.query(analyticsQuery, [
        userId,
        { from: metadata.from, to: state, timestamp: new Date() }
      ]);

    } catch (error) {
      console.error('Error updating user state:', error);
    }
  }

  static async completeOnboarding(userId) {
    try {
      const query = `
        UPDATE users 
        SET onboarding_completed = TRUE,
            updated_at = NOW()
        WHERE id = $1
      `;
      await db.query(query, [userId]);

      await this.updateUserState(userId, this.STATES.ACTIVE_TRACKING, {
        from: 'onboarding',
        completed: true
      });

    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  // Helper to determine if user needs specific guidance
  static async needsGuidance(userId) {
    const state = await this.getUserState(userId);
    
    const guidanceStates = [
      this.STATES.NEW_USER,
      this.STATES.ONBOARDING_WELCOME,
      this.STATES.GOAL_DISCOVERY,
      this.STATES.INCOME_COLLECTION,
      this.STATES.EXPENSE_ANALYSIS,
      this.STATES.PLAN_CREATION
    ];

    return guidanceStates.includes(state);
  }
}

module.exports = ConversationState;