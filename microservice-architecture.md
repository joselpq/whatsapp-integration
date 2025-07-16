# WhatsApp Microservice Architecture

## Overview
A minimal microservice that handles WhatsApp message sending/receiving with proper handling of template vs free messages based on the 24-hour window rule.

## Key Design Principles
1. **Minimal Responsibility**: Only handles WhatsApp communication
2. **Message Type Awareness**: Automatically determines template vs free message
3. **Multi-Phone Support**: Handle multiple WhatsApp Business phone numbers
4. **Storage for Access**: All messages stored for other services to query
5. **Stateless**: No business logic, just message transport

## API Endpoints

### 1. Send Message
```http
POST /api/v1/messages/send
```

Request:
```json
{
  "from": "+1234567890",      // Business phone number
  "to": "+0987654321",         // Recipient
  "userId": "user_123",        // Optional user identifier
  "content": {
    "type": "text",
    "text": "Hello, how can I help you?"
  },
  "forceTemplate": false       // Optional: force template usage
}
```

Response:
```json
{
  "messageId": "wamid.xxx",
  "status": "sent",
  "messageType": "free",       // or "template"
  "conversationId": "conv_123",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### 2. Send Template
```http
POST /api/v1/messages/template
```

Request:
```json
{
  "from": "+1234567890",
  "to": "+0987654321",
  "userId": "user_123",
  "template": {
    "name": "appointment_reminder",
    "language": "pt_BR",
    "components": [
      {
        "type": "body",
        "parameters": [
          {"type": "text", "text": "Dr. Silva"},
          {"type": "text", "text": "15/01/2025 14:30"}
        ]
      }
    ]
  }
}
```

### 3. Get Messages
```http
GET /api/v1/messages?userId=user_123&limit=50&offset=0
```

Response:
```json
{
  "messages": [
    {
      "id": "msg_123",
      "messageId": "wamid.xxx",
      "direction": "inbound",
      "from": "+0987654321",
      "to": "+1234567890",
      "userId": "user_123",
      "content": {
        "type": "text",
        "text": "Oi, preciso de ajuda"
      },
      "timestamp": "2025-01-15T10:28:00Z",
      "status": "received"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

### 4. Get Conversation Status
```http
GET /api/v1/conversations/status?userId=user_123
```

Response:
```json
{
  "userId": "user_123",
  "phoneNumber": "+0987654321",
  "conversationWindow": {
    "isOpen": true,
    "expiresAt": "2025-01-16T10:28:00Z",
    "lastUserMessage": "2025-01-15T10:28:00Z"
  },
  "canSendFreeMessage": true
}
```

### 5. Webhook (Incoming Messages)
```http
POST /webhook/whatsapp
GET /webhook/whatsapp  // For Meta verification
```

## Database Schema

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  message_id VARCHAR(255) UNIQUE,  -- WhatsApp message ID
  user_id VARCHAR(255),
  conversation_id VARCHAR(255),
  direction ENUM('inbound', 'outbound'),
  from_number VARCHAR(20),
  to_number VARCHAR(20),
  content JSONB,
  message_type ENUM('free', 'template'),
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  metadata JSONB  -- For additional WhatsApp data
);

CREATE INDEX idx_user_id ON messages(user_id);
CREATE INDEX idx_conversation_id ON messages(conversation_id);
CREATE INDEX idx_created_at ON messages(created_at);
```

### Conversations Table
```sql
CREATE TABLE conversations (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  phone_number VARCHAR(20),
  last_user_message_at TIMESTAMP,
  window_expires_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_user_conversations ON conversations(user_id);
```

### Phone Numbers Table
```sql
CREATE TABLE phone_numbers (
  id VARCHAR(255) PRIMARY KEY,  -- Meta Phone Number ID
  phone_number VARCHAR(20) UNIQUE,
  display_name VARCHAR(255),
  quality_rating VARCHAR(20),
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Core Services

### 1. Message Service
```typescript
interface MessageService {
  // Automatically determines if template is needed
  sendMessage(params: SendMessageParams): Promise<MessageResponse>
  
  // Force template message
  sendTemplate(params: SendTemplateParams): Promise<MessageResponse>
  
  // Get user's messages
  getMessages(userId: string, options: PaginationOptions): Promise<MessageList>
  
  // Check if can send free message
  canSendFreeMessage(userId: string): Promise<boolean>
}
```

### 2. Conversation Manager
```typescript
interface ConversationManager {
  // Update conversation window on incoming message
  updateConversationWindow(userId: string, phoneNumber: string): void
  
  // Check if conversation window is open
  isWindowOpen(userId: string): boolean
  
  // Get conversation status
  getConversationStatus(userId: string): ConversationStatus
}
```

### 3. Webhook Handler
```typescript
interface WebhookHandler {
  // Process incoming webhook events
  handleIncomingMessage(message: WhatsAppMessage): void
  
  // Handle status updates
  handleStatusUpdate(status: StatusUpdate): void
  
  // Verify webhook signature
  verifySignature(payload: any, signature: string): boolean
}
```

## Message Flow

### Sending Messages
```
1. Client calls /api/v1/messages/send
2. Service checks conversation window
3. If window open (< 24h): Send as free message
4. If window closed: 
   - If forceTemplate=false: Return error
   - If forceTemplate=true: Send as template
5. Store message in database
6. Return response with messageType
```

### Receiving Messages
```
1. WhatsApp sends webhook to /webhook/whatsapp
2. Verify signature
3. Parse message
4. Update conversation window
5. Store in database
6. Emit event for other services (optional)
```

## Environment Variables
```env
# WhatsApp Configuration
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBERS=id1:+55xxx,id2:+55yyy
META_APP_SECRET=
WEBHOOK_VERIFY_TOKEN=

# Database
DATABASE_URL=

# Service Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "CONVERSATION_WINDOW_CLOSED",
    "message": "Cannot send free message. Conversation window expired.",
    "details": {
      "windowExpiredAt": "2025-01-14T10:28:00Z",
      "useTemplate": true
    }
  }
}
```

### Error Codes
- `CONVERSATION_WINDOW_CLOSED` - 24h window expired
- `INVALID_PHONE_NUMBER` - Phone number not configured
- `TEMPLATE_NOT_FOUND` - Template doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many messages
- `WHATSAPP_API_ERROR` - Meta API error

## Security Considerations

1. **API Authentication**: Use API keys or JWT tokens
2. **Webhook Verification**: Always verify Meta signatures
3. **Rate Limiting**: Implement per-user and per-phone limits
4. **Data Encryption**: Encrypt sensitive message content
5. **Access Control**: Validate user access to phone numbers

## Integration Example

```typescript
// Financial Assistant Service
class FinancialAssistant {
  async handleUserQuery(userId: string, query: string) {
    // Check if can send free message
    const status = await whatsappAPI.getConversationStatus(userId);
    
    if (status.canSendFreeMessage) {
      // Send response as free message
      await whatsappAPI.sendMessage({
        from: process.env.BOT_PHONE,
        to: status.phoneNumber,
        userId: userId,
        content: {
          type: 'text',
          text: 'Aqui está sua análise financeira...'
        }
      });
    } else {
      // Queue for later or send template
      await messageQueue.add({
        userId,
        response: 'Análise pronta',
        sendAt: status.conversationWindow.expiresAt
      });
    }
  }
}
```

## Monitoring & Metrics

Key metrics to track:
- Messages sent/received per minute
- Template vs free message ratio
- Conversation window hit rate
- API response times
- Error rates by type
- Phone number health scores