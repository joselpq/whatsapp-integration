# WhatsApp Integration Service

WhatsApp Business API integration for ZenMind Financial Assistant - providing automated financial advice through WhatsApp.

## 🚀 Features

- ✅ **WhatsApp Webhook Integration** - Receives and processes messages in real-time
- ✅ **PostgreSQL Database** - Persistent storage for users, conversations, and messages
- ✅ **24-Hour Conversation Window** - Automatic tracking and management
- ✅ **Template/Free Message Routing** - Intelligent message type selection
- ✅ **Auto-responses** - Basic Arnaldo personality responses
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
   npm run db:setup      # Local development
   npm run db:setup-prod # Production (Railway)
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

# Business Configuration
BUSINESS_PHONE_NUMBER=+5511939041011
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

## 🤖 Current Auto-responses

Arnaldo responds to these keywords:
- **Greetings** ("oi", "olá", "hello") → Introduction and 3-step plan
- **Help** ("help", "ajuda") → Lists available services
- **Thanks** ("obrigado", "valeu") → Motivational response
- **Default** → Echoes message and asks about finances

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

# Verify database connection
npm run db:verify
```

### Manual Testing
1. Send WhatsApp message to +5511939041011
2. Check Railway logs for webhook activity
3. Receive auto-response from Arnaldo
4. Check `/health` endpoint for statistics

## 📊 Database Schema

- **users** - WhatsApp users with profile data
- **conversations** - Tracks 24-hour windows
- **messages** - Complete message history
- **phone_numbers** - Business phone configurations

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
│   └── whatsapp/         # WhatsApp API client
├── scripts/              # Setup and utility scripts
├── tools/                # Testing tools
└── database/             # SQL schemas
```

## 🚧 Next Steps

- [ ] Integrate AI for intelligent financial advice
- [ ] Add more WhatsApp message templates
- [ ] Implement conversation analytics
- [ ] Add rate limiting and quota management

## 📞 Support

For issues or questions about the WhatsApp integration, check the logs or contact the development team.