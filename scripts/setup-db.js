require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/database/db');

async function setupDatabase() {
  try {
    console.log('🔧 Setting up ZenMind database...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    console.log('📝 Creating tables and indexes...');
    await db.query(schema);
    
    // Insert default phone number
    const phoneNumberId = process.env.TEST_PHONE_NUMBER_ID;
    const businessNumber = process.env.BUSINESS_PHONE_NUMBER || '+5511939041011';
    
    if (phoneNumberId && businessNumber) {
      console.log('📱 Adding business phone number...');
      await db.query(`
        INSERT INTO phone_numbers (id, phone_number, display_name, status)
        VALUES ($1, $2, 'ZenMind Financial Assistant', 'active')
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [phoneNumberId, businessNumber]);
    }
    
    console.log('✅ Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Add DATABASE_URL to your Railway environment variables');
    console.log('2. Deploy the updated service to Railway');
    console.log('3. Test the API endpoints');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;