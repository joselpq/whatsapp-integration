// Development tools for testing
const db = require('../database/db');

class DevTools {
  static async resetUser(phoneNumber) {
    try {
      console.log(`🔄 Resetting user data for ${phoneNumber}...`);
      
      // First, let's see what users exist
      const allUsersQuery = `SELECT id, phone_number, created_at FROM users ORDER BY created_at DESC LIMIT 10`;
      const allUsers = await db.query(allUsersQuery);
      console.log(`📋 Found ${allUsers.rows.length} users in database:`);
      allUsers.rows.forEach(user => {
        console.log(`  - ID: ${user.id}, Phone: ${user.phone_number}, Created: ${user.created_at}`);
      });
      
      // Try multiple phone number formats
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const withPlus = `+${cleanPhone}`;
      const withoutPlus = cleanPhone;
      
      console.log(`📱 Trying formats: "${phoneNumber}", "${withPlus}", "${withoutPlus}"`);
      
      // Get user ID first - try all possible formats
      const userQuery = `
        SELECT id, phone_number FROM users 
        WHERE phone_number IN ($1, $2, $3)
      `;
      const userResult = await db.query(userQuery, [phoneNumber, withPlus, withoutPlus]);
      
      if (userResult.rows.length === 0) {
        console.log('❌ User not found');
        return { success: false, message: 'User not found' };
      }
      
      const userId = userResult.rows[0].id;
      const foundPhone = userResult.rows[0].phone_number;
      console.log(`👤 Found user ID: ${userId} with phone: ${foundPhone}`);
      
      // Count what we're about to delete
      const messageCount = await db.query('SELECT COUNT(*) as count FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)', [userId]);
      const conversationCount = await db.query('SELECT COUNT(*) as count FROM conversations WHERE user_id = $1', [userId]);
      
      console.log(`📊 Found ${messageCount.rows[0].count} messages and ${conversationCount.rows[0].count} conversations to delete`);
      
      // Delete user data in reverse dependency order
      const deletions = [
        { table: 'analytics_events', query: 'DELETE FROM analytics_events WHERE user_id = $1' },
        { table: 'expenses', query: 'DELETE FROM expenses WHERE user_id = $1' },
        { table: 'goals', query: 'DELETE FROM goals WHERE user_id = $1' },
        { table: 'daily_summaries', query: 'DELETE FROM daily_summaries WHERE user_id = $1' },
        { table: 'insights', query: 'DELETE FROM insights WHERE user_id = $1' },
        { table: 'messages', query: 'DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)' },
        { table: 'conversations', query: 'DELETE FROM conversations WHERE user_id = $1' },
        { table: 'user_states', query: 'DELETE FROM user_states WHERE user_id = $1' }
      ];
      
      for (const deletion of deletions) {
        const result = await db.query(deletion.query, [userId]);
        console.log(`🗑️  Deleted ${result.rowCount} rows from ${deletion.table}`);
      }
      
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

  static async resetUserById(userId) {
    try {
      console.log(`🚨 EMERGENCY RESET for user ID: ${userId}`);
      
      // Verify user exists
      const userQuery = `SELECT id, phone_number, created_at FROM users WHERE id = $1`;
      const userResult = await db.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        console.log('❌ User ID not found');
        return { success: false, message: 'User ID not found' };
      }
      
      const user = userResult.rows[0];
      console.log(`👤 Found user: ID=${user.id}, Phone=${user.phone_number}, Created=${user.created_at}`);
      
      // Count what we're about to delete
      const messageCount = await db.query('SELECT COUNT(*) as count FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)', [userId]);
      const conversationCount = await db.query('SELECT COUNT(*) as count FROM conversations WHERE user_id = $1', [userId]);
      
      console.log(`📊 Found ${messageCount.rows[0].count} messages and ${conversationCount.rows[0].count} conversations to delete`);
      
      // Delete user data in reverse dependency order
      const deletions = [
        { table: 'analytics_events', query: 'DELETE FROM analytics_events WHERE user_id = $1' },
        { table: 'expenses', query: 'DELETE FROM expenses WHERE user_id = $1' },
        { table: 'goals', query: 'DELETE FROM goals WHERE user_id = $1' },
        { table: 'daily_summaries', query: 'DELETE FROM daily_summaries WHERE user_id = $1' },
        { table: 'insights', query: 'DELETE FROM insights WHERE user_id = $1' },
        { table: 'messages', query: 'DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)' },
        { table: 'conversations', query: 'DELETE FROM conversations WHERE user_id = $1' },
        { table: 'user_states', query: 'DELETE FROM user_states WHERE user_id = $1' }
      ];
      
      let totalDeleted = 0;
      for (const deletion of deletions) {
        const result = await db.query(deletion.query, [userId]);
        console.log(`🗑️  Deleted ${result.rowCount} rows from ${deletion.table}`);
        totalDeleted += result.rowCount;
      }
      
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
      
      console.log(`✅ User ${userId} reset completed! Deleted ${totalDeleted} total records`);
      
      return {
        success: true,
        message: `User ${userId} reset successfully`,
        deletedRecords: totalDeleted,
        phone: user.phone_number
      };
      
    } catch (error) {
      console.error('❌ Error in emergency reset:', error);
      return {
        success: false,
        message: `Reset failed: ${error.message}`
      };
    }
  }

  static async debugMessages(userId) {
    try {
      console.log(`🔍 DEBUGGING MESSAGES for user ID: ${userId}`);
      
      // Check if user exists
      const userQuery = `SELECT id, phone_number, created_at FROM users WHERE id = $1`;
      const userResult = await db.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }
      
      const user = userResult.rows[0];
      console.log(`👤 User: ${user.phone_number}, Created: ${user.created_at}`);
      
      // Count messages using the EXACT same query as Arnaldo
      const arnaldoQuery = `
        SELECT 
          m.direction,
          m.content,
          m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
        ORDER BY m.created_at ASC
      `;
      const arnaldoResult = await db.query(arnaldoQuery, [userId]);
      
      // Count outbound messages (for first message detection)
      const outboundQuery = `
        SELECT COUNT(*) as count 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = $1 AND m.direction = 'outbound'
      `;
      const outboundResult = await db.query(outboundQuery, [userId]);
      
      // Get conversation count
      const conversationQuery = `SELECT COUNT(*) as count FROM conversations WHERE user_id = $1`;
      const conversationResult = await db.query(conversationQuery, [userId]);
      
      const result = {
        success: true,
        user: {
          id: user.id,
          phone: user.phone_number,
          created: user.created_at
        },
        arnaldoHistoryMessages: arnaldoResult.rows.length,
        outboundMessages: parseInt(outboundResult.rows[0].count),
        conversations: parseInt(conversationResult.rows[0].count),
        sampleMessages: arnaldoResult.rows.slice(0, 3).map(m => ({
          direction: m.direction,
          content: typeof m.content === 'string' ? m.content.substring(0, 50) + '...' : m.content,
          created: m.created_at
        }))
      };
      
      console.log(`📊 Results:`, result);
      return result;
      
    } catch (error) {
      console.error('❌ Error debugging messages:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = DevTools;