# Development Setup Guide

## Quick Start for New Team Members

### Prerequisites
- Node.js 18+
- Git access to repository
- WhatsApp Business Account (for testing)
- OpenAI API key
- Railway account access (for production database)

### 1. Repository Setup

```bash
# Clone the repository
git clone [repository-url]
cd whatsapp-integration

# Install dependencies
npm install
```

### 2. Environment Configuration

Create `.env` file with the following variables:

```env
# WhatsApp Business API Configuration
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
TEST_PHONE_NUMBER_ID=your_test_phone_number_id
TEST_ACCESS_TOKEN=your_whatsapp_access_token

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_custom_verify_token
PORT=3000

# Database Connection
DATABASE_URL=postgresql://postgres:GpNpXGDyGbmhjHfMkwvBlgMYIyyuZShq@shortline.proxy.rlwy.net:40462/railway

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Testing Configuration
YOUR_WHATSAPP_NUMBER=+5511976196165
BUSINESS_PHONE_NUMBER=+5511939041011

# Development Tools
DEV_TOOLS_ENABLED=true
```

### 3. Database Setup

#### Production Database Access
The project uses Railway PostgreSQL with external access:

```bash
# Test database connection
psql "postgresql://postgres:GpNpXGDyGbmhjHfMkwvBlgMYIyyuZShq@shortline.proxy.rlwy.net:40462/railway"

# Or verify connection via Node.js
npm run db:verify
```

#### Database Schema
The simplified architecture uses minimal tables:

```sql
-- Core tables (active)
users (id, phone_number, created_at, updated_at)
conversations (id, user_id, updated_at)
messages (id, conversation_id, direction, content, created_at)

-- Legacy tables (exist but unused)
goals, expenses, analytics_events, user_states, financial_profiles
```

### 4. Local Development

```bash
# Start development server
npm run dev

# Or start with nodemon for auto-reload
npx nodemon server.js
```

#### Testing Webhook Locally

1. **Install ngrok** (for webhook testing):
```bash
npm install -g ngrok
ngrok http 3000
```

2. **Update WhatsApp webhook URL**:
   - Go to Meta Developer Console
   - Update webhook URL to: `https://your-ngrok-url.ngrok.io/webhook`
   - Verify webhook with your WEBHOOK_VERIFY_TOKEN

### 5. Service Architecture Overview

The simplified architecture consists of 3 main services:

```javascript
// Service structure
src/services/
├── ArnaldoGoalDiscovery.js    // AI goal discovery (OpenAI integration)
├── ArnaldoAgent.js            // Business logic orchestrator  
└── WhatsAppMessagingService.js // Pure messaging (no business logic)
```

#### Service Responsibilities:

**ArnaldoGoalDiscovery.js**:
- OpenAI GPT-4o integration
- Goal discovery conversation logic
- Portuguese language processing
- Implements 9 core principles (see ARNALDO_PRINCIPLES.md)

**ArnaldoAgent.js**:
- Orchestrates conversation flow
- Detects first-time users
- Sends welcome messages
- Manages business rules

**WhatsAppMessagingService.js**:
- WhatsApp Business API communication
- Message storage and status updates
- Conversation window tracking
- Zero business logic

### 6. Development Tools

#### Built-in Debugging Endpoints

```bash
# 🟢 EMERGENCY RESET - THE ONLY RELIABLE METHOD
POST /dev/emergency-reset
Body: {"userId": "xxx-xxx-xxx"}
# Use this for all user resets!

# Get user status (to find userId for reset)
GET /dev/user-status/:phoneNumber
# Returns userId and statistics

# Debug user messages
GET /dev/debug-messages/:userId
# Shows message counts and samples
```

#### DevTools Class Usage

```javascript
const DevTools = require('./src/utils/dev-tools');

// Get user status and statistics
const status = await DevTools.getUserStatus('+5511976196165');
console.log('User:', status);

// Debug message counts and sample messages
const debug = await DevTools.debugMessages(userId);
console.log('Messages:', debug);

// Emergency reset (bypasses phone number format issues)
const reset = await DevTools.resetUserById(userId);
console.log('Reset result:', reset);

// List recent users
const users = await DevTools.listRecentUsers(5);
console.log('Recent users:', users);
```

#### Direct Database Operations

```javascript
// Manual database access for debugging
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

await client.connect();

// Check for duplicate users
const duplicates = await client.query(`
  SELECT phone_number, COUNT(*) as count 
  FROM users 
  GROUP BY phone_number 
  HAVING COUNT(*) > 1
`);

// Find user by phone (handles format variations)
const user = await client.query(`
  SELECT * FROM users 
  WHERE phone_number LIKE '%976196165%'
`);

await client.end();
```

### 7. Testing Procedures

#### Manual Testing Flow

1. **Reset test user (USE EMERGENCY RESET)**:
```bash
# Step 1: Get user ID
curl http://localhost:3000/dev/user-status/+5511976196165 | jq -r '.userId'

# Step 2: Emergency reset
curl -X POST http://localhost:3000/dev/emergency-reset \
  -H "Content-Type: application/json" \
  -d '{"userId": "xxx-xxx-xxx"}'
```

2. **Send test message** via WhatsApp to +5511939041011

3. **Check logs** for webhook activity:
```bash
# Local development
console.log output

# Production
Railway dashboard → Logs
```

4. **Verify welcome message** is sent automatically

5. **Test goal discovery** conversation flow

#### Automated Testing

```bash
# Run test suite (if available)
npm test

# Test WhatsApp API connection
npm run test-info

# Test message sending
npm run test-send
```

### 8. Common Development Issues

#### Phone Number Format Issues
- Database may store `+5511976196165` 
- API calls might use `5511976196165`
- Always normalize format or use user ID for operations

#### Reset Not Working
- Use emergency reset ONLY: `POST /dev/emergency-reset` with `{"userId": "xxx"}`
- DO NOT use phone-based reset endpoints (they have format issues)
- Emergency reset bypasses all phone format problems

#### AI Memory Issues
- AI gets full conversation history for context
- After reset, history should be empty
- Check message count with debug endpoint

#### Database Connection
- External URL required for local development
- Internal URL only works within Railway environment
- Test connection before starting development

### 9. Production Deployment

#### Railway Configuration
- Automatic deployment from `main` branch
- PostgreSQL database auto-connected
- Environment variables set in Railway dashboard

#### Deployment Process
```bash
# Deploy changes
git add .
git commit -m "Your changes"
git push origin main

# Monitor deployment
# Check Railway dashboard for build logs
```

#### Health Monitoring
```bash
# Check service health
curl https://your-app.up.railway.app/health

# Monitor webhook activity in Railway logs
```

### 10. Architecture Migration Notes

#### What Changed from Complex to Simple:
- **Removed**: ConversationSupervisor, OnboardingFlow, complex state machines
- **Simplified**: Single AI mission, direct service calls, minimal state tracking
- **Kept**: WhatsApp integration, database models, core message flow

#### Archived Services:
Located in `src/archive/` - kept for reference but not used:
- `ConversationSupervisor.js` - Complex flow manager
- `OnboardingFlow.js` - Multi-step onboarding  
- `ArnaldoAI.js` - Old multi-mission AI
- `WhatsAppService.js` - Mixed messaging + business logic

### 11. Key File Locations

```
Important files for new developers:
├── server.js                           # Main webhook handler
├── src/services/ArnaldoGoalDiscovery.js # AI service
├── src/services/ArnaldoAgent.js         # Business orchestrator
├── src/utils/dev-tools.js               # Development utilities
├── ARCHITECTURE.md                      # Technical architecture
├── ARNALDO_PRINCIPLES.md                # AI behavior guidelines
├── TROUBLESHOOTING.md                   # Common issues & solutions
└── .env                                # Environment configuration
```

### 12. Getting Help

#### Documentation:
- `ARCHITECTURE.md` - Technical system design
- `ARNALDO_PRINCIPLES.md` - AI behavior and conversation rules
- `TROUBLESHOOTING.md` - Common issues and solutions
- `README.md` - Project overview and features

#### Debug Resources:
- Railway logs for production issues
- DevTools class for user management
- Debug endpoints for message analysis
- Direct database access for complex issues

#### Contact Information:
- **Test Phone**: +5511976196165
- **Production Database**: Available via Railway
- **Development Tools**: `src/utils/dev-tools.js`

### 13. Best Practices

#### Code Organization:
- Keep business logic in services, not in server.js
- Maintain clean separation between messaging and business logic
- Use DevTools for development operations, not production code

#### Testing:
- Always test user reset functionality
- Verify phone number format consistency
- Check welcome message behavior for new users
- Test AI goal discovery conversation flow

#### Database:
- Use user ID instead of phone number for internal operations
- Monitor for duplicate users with different phone formats
- Regular cleanup of test data during development

#### AI Configuration:
- Don't modify core principles without updating documentation
- Test conversation flow after any AI prompt changes
- Monitor for off-mission behavior or unexpected responses