// Validate required environment variables
function validateConfig() {
  const required = [
    'TEST_ACCESS_TOKEN',
    'TEST_PHONE_NUMBER_ID',
    'WEBHOOK_VERIFY_TOKEN',
    'META_APP_SECRET',
    'OPENAI_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file');
    process.exit(1);
  }
  
  // Validate DATABASE_URL if not in test mode
  if (process.env.NODE_ENV !== 'test' && !process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not configured - using in-memory storage');
  }
  
  // Validate phone number format
  if (process.env.BUSINESS_PHONE_NUMBER && !process.env.BUSINESS_PHONE_NUMBER.match(/^\+\d{10,15}$/)) {
    console.warn('⚠️  BUSINESS_PHONE_NUMBER should be in international format (e.g., +5511999999999)');
  }
  
  console.log('✅ Configuration validated successfully');
}

module.exports = validateConfig;