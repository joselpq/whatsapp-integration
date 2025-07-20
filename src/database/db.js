const { Pool } = require('pg');

class Database {
  constructor() {
    // Only create pool if DATABASE_URL is provided
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      
      // Test connection
      this.pool.on('error', (err) => {
        console.error('Unexpected database error:', err);
      });
    } else {
      console.warn('⚠️  DATABASE_URL not set - database features disabled');
      this.pool = null;
    }
  }

  async query(text, params) {
    if (!this.pool) {
      throw new Error('Database not configured');
    }
    
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getClient() {
    return this.pool.connect();
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new Database();