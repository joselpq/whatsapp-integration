# WhatsApp Integration Service

A microservice for handling WhatsApp Business API integration with webhook support.

## Features

- Webhook endpoint for receiving WhatsApp messages
- Message storage and retrieval API
- Conversation window tracking (24-hour rule)
- Signature verification for security

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see below)
4. Run locally: `npm start`

## Environment Variables

```env
# Meta/WhatsApp Configuration
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
META_APP_SECRET=your_app_secret
TEST_PHONE_NUMBER_ID=your_phone_number_id
TEST_ACCESS_TOKEN=your_access_token

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_verify_token
PORT=3000
```

## API Endpoints

- `GET /webhook` - Webhook verification
- `POST /webhook` - Receive WhatsApp events
- `GET /api/messages` - Retrieve stored messages
- `GET /api/conversations/:userId` - Check conversation status
- `GET /health` - Health check

## Deployment

This service is configured for Railway deployment. Push to main branch to auto-deploy.

## Testing

- Send test message: `npm run test-send`
- Get phone info: `npm run test-info`