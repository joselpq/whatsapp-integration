# WhatsApp Integration Service

WhatsApp Business API integration for ZenMind Financial Assistant - providing automated financial advice through WhatsApp.

## 🚀 Features

- ✅ **WhatsApp Webhook Integration** - Receives and processes messages in real-time
- ✅ **PostgreSQL Database** - Persistent storage for users, conversations, and messages
- ✅ **Persistent State Management** - Reliable conversation state tracking
- ✅ **Structured Onboarding Flow** - Goal-first user journey
- ✅ **AI Financial Advisor (Arnaldo)** - OpenAI-powered financial guidance
- ✅ **Expense & Income Tracking** - Natural language processing
- ✅ **24-Hour Conversation Window** - Automatic tracking and management
- ✅ **Template/Free Message Routing** - Intelligent message type selection
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

## 🤖 Arnaldo - AI Financial Assistant

### Onboarding Flow
1. **Welcome** → User sends "Oi"
2. **Goal Discovery** → Select financial priority (1-4)
3. **Income Collection** → Share monthly income
4. **Active Tracking** → Start logging expenses

### Conversation Capabilities
- **Expense Tracking**: "gastei 50 no mercado"
- **Income Updates**: "ganho 3000 por mês"
- **Financial Advice**: AI-powered contextual guidance
- **Goal Management**: Track progress toward objectives
- **Emergency Mode**: Crisis detection and support

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
# Reset user for testing (dev only)
node tools/reset-user.js +5511999999999

# Debug user state
curl https://your-app.up.railway.app/dev/debug-state/5511999999999
```

### Manual Testing
1. Send WhatsApp message to +5511939041011
2. Check Railway logs for webhook activity
3. Receive auto-response from Arnaldo
4. Check `/health` endpoint for statistics

## 📊 Database Schema

### Core Tables
- **users** - WhatsApp users with profile data
- **user_states** - Persistent conversation state tracking
- **conversations** - Tracks 24-hour windows
- **messages** - Complete message history

### Financial Tables
- **goals** - User financial objectives
- **expenses** - Tracked spending
- **financial_profiles** - Income and budget data
- **analytics_events** - User behavior tracking

## 🔐 Security

- Request signature verification using Meta App Secret
- Environment-based configuration
- SQL injection prevention via parameterized queries
- Railway's built-in SSL/TLS

## 📁 Project Structure

```
whatsapp-integration/
├── server.js              # Main Express server
├── src/
│   ├── config/           # Configuration validation
│   ├── database/         # Database connection
│   ├── models/           # Data models
│   ├── services/         # Business logic
│   │   ├── WhatsAppService.js    # Message routing
│   │   ├── ConversationState.js  # State management
│   │   └── ArnaldoAI.js          # OpenAI integration
│   ├── flows/            # Conversation flows
│   │   └── OnboardingFlow.js     # User onboarding
│   ├── parsers/          # Natural language parsing
│   └── utils/            # Utilities
├── scripts/              # Setup and migration scripts
├── tests/                # Test suites
├── tools/                # Development tools
└── database/             # SQL schemas
```

## 🏗️ Architecture

The system follows a 3-team bounded context architecture:

1. **Conversation Platform** - WhatsApp integration, state management
2. **Financial Intelligence** - Onboarding, tracking, AI advice
3. **Growth & Analytics** - Insights, engagement, emergency support

See `ARCHITECTURE.md` for detailed design.

## 🚧 Roadmap

### Week 2 (Current)
- [x] Persistent state management
- [x] Structured onboarding flow
- [ ] Goal definition wizard
- [ ] Income-scaled recommendations
- [ ] Daily check-ins

### Week 3
- [ ] Emergency planner
- [ ] Financial insights generator
- [ ] Proactive engagement

### Week 4
- [ ] Analytics dashboard
- [ ] Performance monitoring
- [ ] Launch to 100 beta users

## 📞 Support

For issues or questions about the WhatsApp integration, check the logs or contact the development team.