const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class User {
  static async findByPhoneNumber(phoneNumber) {
    const query = 'SELECT * FROM users WHERE phone_number = $1';
    const result = await db.query(query, [phoneNumber]);
    return result.rows[0] || null;
  }

  static async create(userData) {
    const { phoneNumber, firstName, lastName, timezone = 'America/Sao_Paulo' } = userData;
    const id = uuidv4();
    
    const query = `
      INSERT INTO users (id, phone_number, first_name, last_name, timezone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await db.query(query, [id, phoneNumber, firstName, lastName, timezone]);
    return result.rows[0];
  }

  static async update(id, userData) {
    const { firstName, lastName, timezone } = userData;
    
    const query = `
      UPDATE users 
      SET first_name = $2, last_name = $3, timezone = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [id, firstName, lastName, timezone]);
    return result.rows[0];
  }

  static async findOrCreate(phoneNumber, userData = {}) {
    let user = await this.findByPhoneNumber(phoneNumber);
    
    if (!user) {
      user = await this.create({
        phoneNumber,
        ...userData
      });
    }
    
    return user;
  }
}

module.exports = User;