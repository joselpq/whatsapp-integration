// One-time database setup script for production
// Run this after PostgreSQL is added to Railway

const setupDb = require('./scripts/setup-db');

console.log('🚀 Setting up production database...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Connected' : 'Not found');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Make sure PostgreSQL is added to Railway.');
  process.exit(1);
}

// Run the setup
setupDb().catch(error => {
  console.error('❌ Database setup failed:', error);
  process.exit(1);
});