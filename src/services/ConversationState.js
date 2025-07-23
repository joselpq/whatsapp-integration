const db = require('../database/db');

class ConversationState {
  // Conversation states
  static STATES = {
    NEW_USER: 'new_user',
    ONBOARDING_WELCOME: 'onboarding_welcome',
    GOAL_DISCOVERY: 'goal_discovery',
    GOAL_CLARIFICATION: 'goal_clarification',
    GOAL_COMPLETE: 'goal_complete',
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
      // First check persisted state
      const stateQuery = `
        SELECT current_state, context, updated_at
        FROM user_states 
        WHERE user_id = $1
      `;
      const stateResult = await db.query(stateQuery, [userId]);
      
      if (stateResult.rows.length > 0) {
        const { current_state, context, updated_at } = stateResult.rows[0];
        
        // Check for emergency mode regardless of stored state
        const emergencyCheck = await this.checkEmergencyMode(userId);
        if (emergencyCheck && current_state !== this.STATES.EMERGENCY_MODE) {
          await this.updateUserState(userId, this.STATES.EMERGENCY_MODE, { trigger: 'emergency_detected' });
          return this.STATES.EMERGENCY_MODE;
        }
        
        return current_state;
      }
      
      // No persisted state - determine from user data (backward compatibility)
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

      // New user - set initial state
      const isNewUser = !user.onboarding_completed && 
        (Date.now() - new Date(user.created_at).getTime()) < 5 * 60 * 1000;

      if (isNewUser) {
        await this.updateUserState(userId, this.STATES.ONBOARDING_WELCOME, { source: 'new_user' });
        return this.STATES.ONBOARDING_WELCOME;
      }

      // Check for emergency keywords in recent messages
      const emergencyCheck = await this.checkEmergencyMode(userId);
      if (emergencyCheck) {
        await this.updateUserState(userId, this.STATES.EMERGENCY_MODE, { trigger: 'emergency_detected' });
        return this.STATES.EMERGENCY_MODE;
      }

      // If onboarding not completed, determine step
      if (!user.onboarding_completed) {
        const state = await this.getOnboardingStep(userId);
        await this.updateUserState(userId, state, { source: 'onboarding_step' });
        return state;
      }

      // Normal active user
      await this.updateUserState(userId, this.STATES.ACTIVE_TRACKING, { source: 'active_user' });
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

  static async updateUserState(userId, newState, context = {}) {
    try {
      // Get current state for transition tracking
      const currentStateQuery = `
        SELECT current_state FROM user_states WHERE user_id = $1
      `;
      const currentResult = await db.query(currentStateQuery, [userId]);
      const previousState = currentResult.rows[0]?.current_state || null;
      
      // Update or insert state
      const query = `
        INSERT INTO user_states (user_id, current_state, previous_state, context)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          previous_state = user_states.current_state,
          current_state = EXCLUDED.current_state,
          context = user_states.context || EXCLUDED.context,
          updated_at = NOW()
        RETURNING *
      `;
      
      const result = await db.query(query, [
        userId, 
        newState, 
        previousState, 
        JSON.stringify(context)
      ]);
      
      // Log state transition for analytics
      await this.trackStateTransition(userId, previousState, newState, context);
      
      console.log(`📊 State updated: ${userId} ${previousState} → ${newState}`);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('Error updating user state:', error);
      throw error;
    }
  }
  
  static async trackStateTransition(userId, fromState, toState, context = {}) {
    try {
      const analyticsQuery = `
        INSERT INTO analytics_events (user_id, event_name, properties)
        VALUES ($1, 'state_transition', $2)
      `;
      await db.query(analyticsQuery, [
        userId,
        { 
          from: fromState, 
          to: toState, 
          context,
          timestamp: new Date().toISOString() 
        }
      ]);
    } catch (error) {
      console.error('Error tracking state transition:', error);
      // Don't throw - analytics shouldn't break core flow
    }
  }

  static async completeOnboarding(userId) {
    try {
      // Update user record
      const query = `
        UPDATE users 
        SET onboarding_completed = TRUE,
            updated_at = NOW()
        WHERE id = $1
      `;
      await db.query(query, [userId]);

      // Update state to active tracking
      await this.updateUserState(userId, this.STATES.ACTIVE_TRACKING, {
        onboarding_completed: true,
        completed_at: new Date().toISOString()
      });

      console.log(`✅ Onboarding completed for user ${userId}`);

    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
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
  
  // Get state context for a user
  static async getStateContext(userId) {
    try {
      const query = `
        SELECT current_state, previous_state, context, updated_at
        FROM user_states
        WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        currentState: row.current_state,
        previousState: row.previous_state,
        context: row.context || {},
        lastUpdated: row.updated_at
      };
    } catch (error) {
      console.error('Error getting state context:', error);
      return null;
    }
  }
}

module.exports = ConversationState;