# WhatsApp Integration Service

WhatsApp Business API integration for ZenMind Financial Assistant - featuring Arnaldo, an AI consultant focused exclusively on financial goal discovery.

## 🚀 Features

- ✅ **WhatsApp Webhook Integration** - Receives and processes messages in real-time
- ✅ **PostgreSQL Database** - Persistent storage for users, conversations, and messages
- ✅ **Single-Mission AI (Arnaldo)** - Focused exclusively on financial goal discovery
- ✅ **Goal Discovery Process** - What, when, and how much do you want to achieve?
- ✅ **Clean Architecture** - Simplified services with clear separation of concerns
- ✅ **24-Hour Conversation Window** - Automatic tracking and management
- ✅ **Portuguese Language Support** - Native Brazilian Portuguese conversation
- ✅ **Development Tools** - Reset utilities and debugging endpoints
- ✅ **Security** - Request signature verification
- ✅ **Health Monitoring** - Database and service health checks

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database (provided by Railway)
- WhatsApp Business Account with API access
- Meta App credentials

## 🛠️ Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/yourusername/whatsapp-integration.git
   cd whatsapp-integration
   npm install
   ```

2. **Configure environment:** Copy `.env.example` to `.env` and fill in your values

3. **Database setup:**
   ```bash
   npm run db:setup           # Local development
   npm run db:setup-prod      # Production (Railway)
   npm run db:add-financial   # Add financial tables
   node scripts/add-user-states.js  # Add state persistence
   ```

4. **Run locally:**
   ```bash
   npm run dev
   ```

## 🔧 Environment Variables

```env
# Meta/WhatsApp Configuration
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
TEST_PHONE_NUMBER_ID=your_phone_number_id
TEST_ACCESS_TOKEN=your_access_token

# Your WhatsApp number (for testing)
YOUR_WHATSAPP_NUMBER=+5511999999999

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_verify_token
PORT=3000

# Database (automatically provided by Railway)
DATABASE_URL=postgresql://...

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Business Configuration
BUSINESS_PHONE_NUMBER=+5511939041011

# Development Tools (temporary)
DEV_TOOLS_ENABLED=true
```

## 📡 API Endpoints

### Core Endpoints
- `GET /health` - Service health and statistics
- `GET /webhook` - WhatsApp webhook verification
- `POST /webhook` - Receive WhatsApp messages/events

### Message API
- `POST /api/v1/messages/send` - Send a message
  ```json
  {
    "to": "+5511999999999",
    "content": "Message text",
    "options": {
      "forceTemplate": false
    }
  }
  ```

### Conversation API
- `GET /api/v1/conversations/status/:phone` - Check conversation window status

## 🤖 Arnaldo - AI Financial Goal Discovery

### Single Mission
Arnaldo has **one clear objective**: Discover your financial goal by understanding:
1. **What** you want to achieve financially
2. **When** you want to achieve it
3. **How much** it will cost

### Conversation Flow
1. **Welcome Message** → Automatic greeting for new users
2. **Goal Discovery** → Friendly questions to understand your objective
3. **Confirmation** → "Então podemos considerar que seu objetivo é: [goal summary]"
4. **Completion** → Stops responding after goal is confirmed

### AI Principles
- Friendly and concise communication in Portuguese
- Maximum one question per message
- Uses full conversation history for context
- Temporal awareness (knows current date: July 2025)
- No follow-up messages after goal completion

## 🚀 Deployment

Deployed on Railway with automatic deployments from main branch:

1. **Add PostgreSQL on Railway:**
   - Go to Railway project
   - Click "New" → "Database" → "PostgreSQL"
   - It auto-connects to your service

2. **Deploy updates:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

3. **Monitor:**
   - Health: `https://your-app.up.railway.app/health`
   - Logs: Railway dashboard → Service → Logs

## 🧪 Testing

```bash
# Test WhatsApp API connection
npm run test-info

# Send test message
npm run test-send

# Test complete flow
npm run test-flow

# Test onboarding flow
npm test

# Performance tests
npm run test:performance

# Test state persistence
node tests/test-state-persistence.js

# Verify database connection
npm run db:verify
```

### Development Tools
```bash
# Reset user for testing
POST /dev/reset/:phoneNumber

# Debug user messages
GET /dev/messages/debug/:userId

# Emergency reset by user ID (when phone format issues occur)
POST /dev/reset-user/:userId

# Check user status
const DevTools = require('./src/utils/dev-tools');
await DevTools.getUserStatus(phoneNumber);
```

### Manual Testing
1. Send WhatsApp message to +5511939041011
2. Check Railway logs for webhook activity
3. Receive auto-response from Arnaldo
4. Check `/health` endpoint for statistics

## 📊 Database Schema

### Active Tables (Simplified Architecture)
- **users** - WhatsApp users (id, phone_number, created_at)
- **conversations** - Tracks 24-hour windows (user_id, updated_at)
- **messages** - Complete message history for AI context (conversation_id, direction, content)

### Legacy Tables (Not Currently Used)
- **goals, expenses, financial_profiles, analytics_events** - From previous complex architecture
- **user_states** - Replaced by simple message counting

### Database Troubleshooting
- **Phone Number Formats**: Handle both +5511... and 5511... formats
- **Duplicate Users**: Can occur from format mismatches
- **Direct Access**: postgresql://postgres:GpNpXGDyGbmhjHfMkwvBlgMYIyyuZShq@shortline.proxy.rlwy.net:40462/railway

## 🔐 Security

- Request signature verification using Meta App Secret
- Environment-based configuration
- SQL injection prevention via parameterized queries
- Railway's built-in SSL/TLS

## 📁 Project Structure (Simplified)

```
whatsapp-integration/
├── server.js              # Main Express webhook handler
├── src/
│   ├── services/         # Core business services
│   │   ├── ArnaldoGoalDiscovery.js    # AI goal discovery (OpenAI)
│   │   ├── ArnaldoAgent.js            # Business logic orchestrator
│   │   └── WhatsAppMessagingService.js # Pure messaging (no business logic)
│   ├── models/           # Database models
│   ├── database/         # Database connection
│   └── utils/
│       └── dev-tools.js  # Development and debugging utilities
├── src/archive/          # Archived complex services
│   ├── ConversationSupervisor.js
│   ├── OnboardingFlow.js
│   ├── ArnaldoAI.js (old multi-mission version)
│   └── WhatsAppService.js (old mixed-concern version)
├── scripts/              # Database setup
├── tests/                # Test suites
└── database/             # SQL schemas
```

## 🏗️ Architecture (Simplified)

The system follows a clean, focused architecture with three core services:

1. **ArnaldoGoalDiscovery** - AI service focused solely on financial goal discovery
2. **ArnaldoAgent** - Business logic orchestrator managing conversation flow
3. **WhatsAppMessagingService** - Pure messaging infrastructure with zero business logic

**Key Changes Made:**
- Removed complex multi-agent system and supervisors
- Simplified from 3-team bounded context to single-mission AI
- Eliminated state machines in favor of simple message counting
- Direct service communication instead of event bus
- Clean separation: messaging vs business logic

See `ARCHITECTURE.md` for detailed technical design.

## 🚧 Completed Refactoring

### ✅ Major Simplification (Completed)
- [x] Simplified complex multi-agent architecture
- [x] Single-mission AI focused on goal discovery
- [x] Clean service separation (messaging vs business logic)
- [x] Removed state machine complexity
- [x] Fixed conversation reset functionality
- [x] Added development and debugging tools
- [x] Updated documentation for future team members

### 🔧 Current Status
- **Production**: Deployed on Railway with simplified architecture
- **AI Model**: GPT-4o configured for Portuguese goal discovery
- **Testing**: +5511976196165 for development testing
- **Database**: Direct access available for troubleshooting

### 🎯 Future Considerations
- Goal achievement tracking (after discovery is validated)
- Expense tracking integration (if needed)
- Multi-goal support (based on user feedback)
- Analytics and insights (when user base grows)

## 📞 Support & Troubleshooting

### Common Issues
1. **Reset Not Working**: Use direct database reset with user ID (see TROUBLESHOOTING.md)
2. **Duplicate Users**: Phone number format mismatch (+55... vs 55...)
3. **AI Memory**: Full conversation context may cause unexpected responses
4. **Welcome Message**: Check outbound message count is 0 for new users

### Development Contacts
- **Test Number**: +5511976196165
- **Database**: Direct PostgreSQL access available
- **Logs**: Railway dashboard for production debugging
- **Documentation**: ARCHITECTURE.md, TROUBLESHOOTING.md

For technical issues, use the development tools or check Railway logs for webhook activity.