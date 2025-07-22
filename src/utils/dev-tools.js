// Development tools for testing
const db = require('../database/db');

class DevTools {
  static async resetUser(phoneNumber) {
    try {
      console.log(`🔄 Resetting user data for ${phoneNumber}...`);
      
      // Remove + and keep just numbers
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Get user ID first
      const userQuery = `
        SELECT id FROM users 
        WHERE phone_number = $1 OR phone_number = $2
      `;
      const userResult = await db.query(userQuery, [phoneNumber, cleanPhone]);
      
      if (userResult.rows.length === 0) {
        console.log('❌ User not found');
        return { success: false, message: 'User not found' };
      }
      
      const userId = userResult.rows[0].id;
      console.log(`👤 Found user ID: ${userId}`);
      
      // Delete user data in reverse dependency order
      await db.query('DELETE FROM analytics_events WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM goals WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM daily_summaries WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM insights WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)', [userId]);
      await db.query('DELETE FROM conversations WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM user_states WHERE user_id = $1', [userId]);
      
      // Reset user profile to defaults and reset created_at to be treated as new user
      await db.query(`
        UPDATE users 
        SET 
          monthly_income = NULL,
          payday = NULL,
          family_size = 1,
          onboarding_completed = FALSE,
          premium_subscriber = FALSE,
          premium_started_at = NULL,
          created_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [userId]);
      
      console.log('✅ User data reset successfully');
      
      return { 
        success: true, 
        message: 'User reset successfully - will go through onboarding again',
        userId 
      };
      
    } catch (error) {
      console.error('❌ Error resetting user:', error);
      return { success: false, message: error.message };
    }
  }
  
  static async getUserStatus(phoneNumber) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      const query = `
        SELECT 
          u.id,
          u.phone_number,
          u.monthly_income,
          u.onboarding_completed,
          u.created_at,
          COUNT(DISTINCT e.id) as expense_count,
          COUNT(DISTINCT g.id) as goal_count,
          COUNT(DISTINCT m.id) as message_count
        FROM users u
        LEFT JOIN expenses e ON u.id = e.user_id
        LEFT JOIN goals g ON u.id = g.user_id
        LEFT JOIN conversations c ON u.id = c.user_id
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE u.phone_number = $1 OR u.phone_number = $2
        GROUP BY u.id, u.phone_number, u.monthly_income, u.onboarding_completed, u.created_at
      `;
      
      const result = await db.query(query, [phoneNumber, cleanPhone]);
      
      if (result.rows.length === 0) {
        return { exists: false };
      }
      
      const user = result.rows[0];
      return {
        exists: true,
        userId: user.id,
        phoneNumber: user.phone_number,
        monthlyIncome: user.monthly_income,
        onboardingCompleted: user.onboarding_completed,
        createdAt: user.created_at,
        stats: {
          expenses: parseInt(user.expense_count),
          goals: parseInt(user.goal_count), 
          messages: parseInt(user.message_count)
        }
      };
      
    } catch (error) {
      console.error('Error getting user status:', error);
      return { error: error.message };
    }
  }
  
  static async listRecentUsers(limit = 5) {
    try {
      const query = `
        SELECT 
          phone_number,
          monthly_income,
          onboarding_completed,
          created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }
}

module.exports = DevTools;