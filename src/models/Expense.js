const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Expense {
  static async create(expenseData) {
    const id = uuidv4();
    const query = `
      INSERT INTO expenses (id, user_id, amount, category, description, expense_date)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
      RETURNING *
    `;
    
    const values = [
      id,
      expenseData.userId,
      expenseData.amount,
      expenseData.category || 'outros',
      expenseData.description || 'Despesa',
      expenseData.date || null
    ];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }
  
  static async getTodayExpenses(userId) {
    const query = `
      SELECT * FROM expenses
      WHERE user_id = $1 AND expense_date = CURRENT_DATE
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }
  
  static async getMonthlyExpenses(userId) {
    const query = `
      SELECT * FROM expenses
      WHERE user_id = $1 
      AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
      ORDER BY expense_date DESC, created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }
  
  static async getTodayTotal(userId) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE user_id = $1 AND expense_date = CURRENT_DATE
    `;
    
    const result = await db.query(query, [userId]);
    return parseFloat(result.rows[0].total);
  }
  
  static async getMonthlyTotal(userId) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE user_id = $1 
      AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
    `;
    
    const result = await db.query(query, [userId]);
    return parseFloat(result.rows[0].total);
  }
  
  static async getCategoryBreakdown(userId, period = 'month') {
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = 'AND expense_date = CURRENT_DATE';
    } else if (period === 'week') {
      dateFilter = 'AND expense_date >= CURRENT_DATE - INTERVAL \'7 days\'';
    } else { // month
      dateFilter = 'AND DATE_TRUNC(\'month\', expense_date) = DATE_TRUNC(\'month\', CURRENT_DATE)';
    }
    
    const query = `
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      WHERE user_id = $1 ${dateFilter}
      GROUP BY category
      ORDER BY total DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }
  
  static async getDailySummary(userId, date = null) {
    const targetDate = date || 'CURRENT_DATE';
    const query = `
      SELECT 
        ds.summary_date,
        ds.total_spent,
        ds.daily_budget,
        ds.expense_count,
        ds.categories
      FROM daily_summaries ds
      WHERE ds.user_id = $1 AND ds.summary_date = ${targetDate}
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }
  
  static async getRecentExpenses(userId, days = 7) {
    const query = `
      SELECT 
        expense_date,
        SUM(amount) as daily_total,
        COUNT(*) as expense_count,
        ARRAY_AGG(
          json_build_object(
            'amount', amount,
            'category', category,
            'description', description
          ) ORDER BY created_at DESC
        ) as expenses
      FROM expenses
      WHERE user_id = $1 
      AND expense_date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY expense_date
      ORDER BY expense_date DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }
  
  // Analytics helpers
  static async getAverageDaily(userId) {
    const query = `
      SELECT 
        AVG(daily_total) as average_daily
      FROM (
        SELECT 
          expense_date,
          SUM(amount) as daily_total
        FROM expenses
        WHERE user_id = $1 
        AND expense_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY expense_date
      ) daily_totals
    `;
    
    const result = await db.query(query, [userId]);
    return parseFloat(result.rows[0].average_daily || 0);
  }
  
  static async getTopCategories(userId, limit = 3) {
    const query = `
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average
      FROM expenses
      WHERE user_id = $1 
      AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY category
      ORDER BY total DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }
}

module.exports = Expense;