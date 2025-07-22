const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Goal {
  static async create(goalData) {
    const id = uuidv4();
    const query = `
      INSERT INTO goals (id, user_id, type, name, target_amount, target_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      id,
      goalData.userId,
      goalData.type,
      goalData.name,
      goalData.targetAmount,
      goalData.targetDate || null
    ];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  }
  
  static async getActive(userId) {
    const query = `
      SELECT * FROM goals
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }
  
  static async hasType(userId, type) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM goals 
        WHERE user_id = $1 AND type = $2 AND status = 'active'
      )
    `;
    
    const result = await db.query(query, [userId, type]);
    return result.rows[0].exists;
  }
  
  static async updateProgress(goalId, amount) {
    const query = `
      UPDATE goals 
      SET current_amount = current_amount + $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [goalId, amount]);
    return result.rows[0];
  }
  
  static async complete(goalId) {
    const query = `
      UPDATE goals 
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [goalId]);
    return result.rows[0];
  }
}

module.exports = Goal;