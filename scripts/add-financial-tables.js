// Script to add financial tables to existing database
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/database/db');

async function addFinancialTables() {
  try {
    console.log('🔧 Adding financial tables to database...');
    
    // Read financial schema file
    const schemaPath = path.join(__dirname, '../database/financial-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    console.log('📝 Creating financial tables and indexes...');
    await db.query(schema);
    
    console.log('✅ Financial tables added successfully!');
    console.log('\nNew tables:');
    console.log('  - expenses (track spending)');
    console.log('  - goals (savings goals)');
    console.log('  - daily_summaries (quick stats)');
    console.log('  - insights (AI-generated tips)');
    console.log('  - analytics_events (user behavior)');
    console.log('  - referrals (viral growth tracking)');
    
  } catch (error) {
    console.error('❌ Failed to add financial tables:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  addFinancialTables();
}

module.exports = addFinancialTables;