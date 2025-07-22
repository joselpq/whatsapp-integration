const User = require('./User');
const Message = require('./Message');
const db = require('../database/db');

class UserContext {
  static async build(userId) {
    try {
      // Get user profile with financial info
      const profile = await this.getUserProfile(userId);
      
      // Get recent messages for conversation context
      const messages = await this.getRecentMessages(userId);
      
      // Get today's expenses and budget info
      const expenses = await this.getExpenseContext(userId);
      
      // Get active goals if any
      const goals = await this.getActiveGoals(userId);
      
      return {
        profile,
        messages,
        expenses,
        goals,
        summary: this.generateContextSummary(profile, expenses)
      };
    } catch (error) {
      console.error('Error building user context:', error);
      return {
        profile: null,
        messages: [],
        expenses: {},
        goals: [],
        summary: null
      };
    }
  }

  static async getUserProfile(userId) {
    const query = `
      SELECT 
        u.id,
        u.phone_number,
        u.display_name,
        u.monthly_income,
        u.payday,
        u.family_size,
        u.onboarding_completed,
        u.created_at
      FROM users u
      WHERE u.id = $1
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  static async getRecentMessages(userId, limit = 10) {
    const query = `
      SELECT 
        m.id,
        m.direction,
        m.content,
        m.created_at
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [userId, limit]);
    // Return in chronological order
    return result.rows.reverse();
  }

  static async getExpenseContext(userId) {
    // Get today's expenses
    const todayQuery = `
      SELECT 
        category,
        amount,
        description
      FROM expenses
      WHERE user_id = $1 
      AND expense_date = CURRENT_DATE
      ORDER BY created_at DESC
    `;
    
    const todayResult = await db.query(todayQuery, [userId]);
    const todayExpenses = todayResult.rows;
    const todayTotal = todayExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    // Get month total
    const monthQuery = `
      SELECT 
        COALESCE(SUM(amount), 0) as month_total
      FROM expenses
      WHERE user_id = $1 
      AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
    `;
    
    const monthResult = await db.query(monthQuery, [userId]);
    const monthTotal = parseFloat(monthResult.rows[0].month_total);
    
    // Calculate daily budget
    const profile = await this.getUserProfile(userId);
    const dailyBudget = await this.calculateDailyBudget(userId, profile);
    
    return {
      todayExpenses,
      todayTotal,
      monthTotal,
      dailyBudget,
      remainingToday: dailyBudget - todayTotal
    };
  }

  static async getActiveGoals(userId) {
    const query = `
      SELECT 
        type,
        target_amount,
        current_amount,
        target_date
      FROM goals
      WHERE user_id = $1
      AND (target_date IS NULL OR target_date > CURRENT_DATE)
      ORDER BY created_at DESC
      LIMIT 3
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async calculateDailyBudget(userId, profile) {
    if (!profile || !profile.monthly_income || !profile.payday) {
      return 50; // Default daily budget
    }
    
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    let daysUntilPayday;
    if (currentDay < profile.payday) {
      daysUntilPayday = profile.payday - currentDay;
    } else {
      daysUntilPayday = (daysInMonth - currentDay) + profile.payday;
    }
    
    // Calculate how much money should be left
    const daysSincePayday = daysInMonth - daysUntilPayday;
    const proportionSpent = daysSincePayday / daysInMonth;
    const expectedRemaining = profile.monthly_income * (1 - proportionSpent);
    
    // Simple daily budget
    return expectedRemaining / daysUntilPayday;
  }

  static generateContextSummary(profile, expenses) {
    if (!profile) return null;
    
    return {
      hasIncome: !!profile.monthly_income,
      hasPayday: !!profile.payday,
      isOnboarded: profile.onboarding_completed,
      daysAsUser: Math.floor((Date.now() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24)),
      spendingStatus: expenses.remainingToday > 0 ? 'on_track' : 'over_budget'
    };
  }
}

module.exports = UserContext;