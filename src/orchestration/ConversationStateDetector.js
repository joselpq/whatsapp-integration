const db = require('../database/db');

/**
 * ConversationStateDetector - Detects current conversation phase based on message history
 * Extracted from ArnaldoAgent to provide centralized state detection
 */
class ConversationStateDetector {
  /**
   * Detect the current conversation phase for a user
   * @param {string} userId - User ID
   * @returns {Promise<string>} Current phase: 'welcome', 'goal_discovery', 'monthly_expenses', or 'complete'
   */
  async detectPhase(userId) {
    try {
      // Check if this is first message
      const isFirstMessage = await this._isFirstMessage(userId);
      if (isFirstMessage) {
        return 'welcome';
      }
      
      // Get conversation state
      const state = await this._getConversationState(userId);
      
      if (!state.goalComplete) {
        return 'goal_discovery';
      } else if (!state.expensesComplete) {
        return 'monthly_expenses';
      } else {
        return 'complete';
      }
    } catch (error) {
      console.error('Error detecting conversation phase:', error);
      // Default to goal discovery if error
      return 'goal_discovery';
    }
  }

  /**
   * Check if this is the user's first message
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if first message
   */
  async _isFirstMessage(userId) {
    try {
      // Check if user has any previous outbound messages from Arnaldo
      const query = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 AND m.direction = 'outbound'
      `;
      const result = await db.query(query, [userId]);
      const messageCount = parseInt(result.rows[0].count);
      
      console.log(`📊 User ${userId} has ${messageCount} previous outbound messages`);
      
      // Also check if user was recently created (within last 5 minutes) as backup
      const userQuery = `
        SELECT created_at FROM users WHERE id = $1
      `;
      const userResult = await db.query(userQuery, [userId]);
      const createdAt = new Date(userResult.rows[0].created_at);
      const now = new Date();
      const minutesSinceCreation = (now - createdAt) / (1000 * 60);
      
      console.log(`⏰ User ${userId} created ${minutesSinceCreation.toFixed(1)} minutes ago`);
      
      const isFirst = messageCount === 0;
      console.log(`✅ User ${userId} is first message: ${isFirst}`);
      
      return isFirst;
    } catch (error) {
      console.error('Error checking first message:', error);
      return true; // Default to showing welcome if unsure
    }
  }

  /**
   * Get conversation state indicators
   * @param {string} userId - User ID
   * @returns {Promise<{goalComplete: boolean, expensesComplete: boolean}>} Conversation state
   */
  async _getConversationState(userId) {
    try {
      // Check if we sent the transition message (indicates goal is complete)
      const goalCompleteQuery = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 
        AND m.direction = 'outbound' 
        AND ((m.content::text) LIKE '%Perfeito! Agora vamos entender seus gastos mensais%')
      `;
      console.log(`🔍 Checking goal complete for user ${userId}`);
      const goalResult = await db.query(goalCompleteQuery, [userId]);
      const goalComplete = parseInt(goalResult.rows[0].count) > 0;
      console.log(`🎯 Goal complete: ${goalComplete} (found ${goalResult.rows[0].count} messages)`);
      
      // Check if expenses discovery is complete
      const expensesCompleteQuery = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 
        AND m.direction = 'outbound' 
        AND ((m.content::text) LIKE '%então essa é a estimativa dos seus custos mensais:%')
      `;
      console.log(`💰 Checking expenses complete for user ${userId}`);
      const expensesResult = await db.query(expensesCompleteQuery, [userId]);
      const expensesComplete = parseInt(expensesResult.rows[0].count) > 0;
      console.log(`💰 Expenses complete: ${expensesComplete} (found ${expensesResult.rows[0].count} messages)`);
      
      console.log(`📊 User ${userId} final conversation state: goal=${goalComplete}, expenses=${expensesComplete}`);
      
      // Debug: Let's check the last few messages
      const debugQuery = `
        SELECT m.direction, m.content, m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
        ORDER BY m.created_at DESC
        LIMIT 5
      `;
      const debugResult = await db.query(debugQuery, [userId]);
      console.log(`📝 Last 5 messages for debugging:`);
      debugResult.rows.forEach((row, i) => {
        const content = typeof row.content === 'string' ? row.content.substring(0, 50) : JSON.stringify(row.content).substring(0, 50);
        console.log(`  ${i+1}. ${row.direction}: ${content}...`);
      });
      
      return {
        goalComplete,
        expensesComplete
      };
    } catch (error) {
      console.error('Error getting conversation state:', error);
      return {
        goalComplete: false,
        expensesComplete: false
      };
    }
  }

  /**
   * Get the last outbound message for a user
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Last outbound message content
   */
  async getLastOutboundMessage(userId) {
    try {
      const query = `
        SELECT m.content 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 AND m.direction = 'outbound' 
        ORDER BY m.created_at DESC 
        LIMIT 1
      `;
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      let content = result.rows[0].content;
      
      // Parse JSON content if needed (content is stored as JSON string)
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
      
      return content;
    } catch (error) {
      console.error('Error getting last outbound message:', error);
      return null;
    }
  }
}

module.exports = ConversationStateDetector;