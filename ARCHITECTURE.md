# WhatsApp Financial Assistant Architecture

## Overview
Our architecture follows a simplified, focused design with clear separation of concerns. The system has been refactored from a complex multi-agent system to a single-mission AI focused solely on financial goal discovery.

## Core Principles
1. **Single Mission**: Arnaldo has one clear goal - discover what users want financially, when they want it, and how much it costs
2. **Clean Separation**: Messaging infrastructure is completely separate from business logic
3. **Simplicity First**: Reduced complexity for better reliability and maintainability
4. **Context Preservation**: Full conversation history is passed to AI for better understanding

## Service Architecture

### ArnaldoGoalDiscovery.js
**Mission**: AI service focused exclusively on financial goal discovery

**Responsibilities:**
- Discover user's financial goal (what, when, how much)
- Guide users to clarity through follow-up questions
- Confirm understanding with "Então podemos considerar que seu objetivo é:"
- Maintain friendly, concise conversation style
- One question per message maximum

**Key Features:**
- Uses OpenAI GPT-4o with temperature 0.7, max_tokens 300
- Temporal context awareness (current date: July 2025)
- Full conversation history for context
- Portuguese-language optimized prompts

### ArnaldoAgent.js
**Mission**: Business logic orchestrator for conversation flow

**Responsibilities:**
- Detect first-time users and send welcome message
- Orchestrate AI responses through ArnaldoGoalDiscovery
- Handle conversation state and user interactions
- Manage business rules (no messages after goal completion)

**Key Logic:**
```javascript
// Welcome message for new users
if (outboundCount === 0) {
  await this._sendWelcomeMessage(phoneNumber);
}

// Process through AI for goal discovery
const aiResponse = await this.arnaldoAI.processMessage(phoneNumber, message);
```

### WhatsAppMessagingService.js
**Mission**: Pure messaging infrastructure with zero business logic

**Responsibilities:**
- Send messages via WhatsApp Business API
- Store incoming messages in database
- Update message delivery status
- Manage conversation windows (24-hour limit)

**Clean Interface:**
```javascript
// Pure messaging operations only
async sendMessage(phoneNumber, message)
async storeIncomingMessage(messageInfo)
async updateMessageStatus(messageId, status)
```

## Message Flow Architecture

```
             Incoming WhatsApp Message
                       ↓
              [WhatsApp Webhook]
                    server.js
                       ↓
           WhatsAppMessagingService.storeIncomingMessage()
                       ↓
              ArnaldoAgent.processIncomingMessage()
                       ↓
               [Check if first message]
                  /              \
             Yes /                \ No
                /                  \
    Send Welcome Message     ArnaldoGoalDiscovery.processMessage()
           ↓                           ↓
    WhatsAppMessagingService     [Full conversation context]
       .sendMessage()                   ↓
                                 [OpenAI GPT-4o]
                                 Goal Discovery AI
                                        ↓
                                   AI Response
                                        ↓
                             WhatsAppMessagingService
                                .sendMessage()
```

## Conversation State Management

**Simplified State Model:**
The system uses minimal state tracking focused on message counting and conversation windows rather than complex state machines.

```javascript
// Primary state indicators
const isFirstMessage = (outboundMessageCount === 0);
const conversationActive = (within24HourWindow);

// No complex state transitions - just:
// 1. First message -> Welcome
// 2. Subsequent messages -> Goal Discovery AI
// 3. Goal completion -> Stop responding
```

**Key State Data:**
- `outbound_message_count`: Determines if welcome message needed
- `conversation.updated_at`: Tracks 24-hour conversation window
- `message_history`: Full context for AI processing

## Database Schema (Simplified)

**Core Tables Used:**
```sql
-- User management
users (id, phone_number, created_at, updated_at)

-- Conversation tracking
conversations (id, user_id, updated_at) -- tracks 24h window

-- Message history (full context for AI)
messages (id, conversation_id, direction, content, created_at)
```

**Currently Unused (Legacy):**
```sql
-- These exist but are not used in simplified architecture
goals, expenses, analytics_events, user_states, insights
```

## Service Communication

**Direct Method Calls (No Event Bus):**
The simplified architecture uses direct service method calls for clarity and debugging.

```javascript
// ArnaldoAgent orchestrates the flow
class ArnaldoAgent {
  constructor() {
    this.messagingService = new WhatsAppMessagingService();
    this.arnaldoAI = new ArnaldoGoalDiscovery();
  }
  
  async processIncomingMessage(messageInfo) {
    // Store message via messaging service
    await this.messagingService.storeIncomingMessage(messageInfo);
    
    // Process via AI service
    const response = await this.arnaldoAI.processMessage(phoneNumber, message);
    
    // Send response via messaging service
    await this.messagingService.sendMessage(phoneNumber, response);
  }
}
```

## Debugging & Development Tools

### 1. Console Logging
```javascript
// Simple console.log statements for debugging
console.log(`🤖 Arnaldo processing message from ${phoneNumber}`);
console.log(`💬 AI Response: ${response}`);
console.log(`✅ Message sent successfully`);
```

### 2. Development Endpoints
```javascript
// Message debugging
GET /dev/messages/debug/:userId
// Returns message count and sample messages

// User reset (for testing)
POST /dev/reset/:phoneNumber
// Clears all user data for fresh testing

// Emergency reset by user ID
POST /dev/reset-user/:userId
// Direct database reset using user ID
```

### 3. Database Direct Access
```javascript
// DevTools class provides direct database operations
DevTools.resetUserById(userId)        // Emergency reset
DevTools.debugMessages(userId)        // Message analysis
DevTools.getUserStatus(phoneNumber)   // User overview
```

## Project Structure

```
whatsapp-integration/
├── src/
│   ├── services/
│   │   ├── ArnaldoGoalDiscovery.js   # AI goal discovery
│   │   ├── ArnaldoAgent.js           # Business orchestrator
│   │   └── WhatsAppMessagingService.js # Pure messaging
│   ├── models/                       # Database models
│   ├── database/                     # DB connection
│   └── utils/
│       └── dev-tools.js             # Development utilities
├── server.js                         # Main webhook handler
├── package.json
└── README.md
```

### Archived Services (Legacy)
```
src/archive/
├── ConversationSupervisor.js        # Complex flow manager
├── OnboardingFlow.js                # Multi-step onboarding
├── ArnaldoAI.js                     # Multi-mission AI
└── WhatsAppService.js               # Business logic mixed with messaging
```

## Key Refactoring Changes Made

### What Was Removed
- Complex multi-agent system with supervisors
- Multi-step onboarding flows
- State machine complexity
- Event bus communication
- Multiple AI missions and contexts

### What Was Simplified
- **Single AI Mission**: Only goal discovery (what, when, how much)
- **Direct Communication**: Service calls instead of event bus
- **Clean Separation**: Messaging service has zero business logic
- **Minimal State**: Just message counting and conversation windows
- **One Question Rule**: AI asks maximum one question per response

### Migration Benefits
- **Reliability**: Fewer moving parts = fewer failure points
- **Debuggability**: Clear service boundaries and simple call flow
- **Performance**: No complex routing or state management overhead
- **Maintainability**: Single-purpose services with clear responsibilities

## Current AI Configuration

### OpenAI Settings
- **Model**: GPT-4o
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Max Tokens**: 300 (concise responses)
- **Language**: Portuguese (Brazilian)

### Arnaldo's Goal Discovery Rules
1. Discover what user wants to achieve financially
2. If user knows their goal, confirm the 3 elements (what, when, how much)
3. If unclear, guide with follow-up questions toward convergence
4. Once discovered, state back clearly with "Então podemos considerar que seu objetivo é:"
5. Communication should be friendly and concise
6. Maximum one question per message
7. Pass entire conversation history for full context
8. Include temporal context (current date: July 2025)
9. **Stop responding after goal completion statement**

### Welcome Message
```
Oi! Sou o Arnaldo, seu consultor financeiro pessoal! 👋

Vou te ajudar a organizar suas finanças e realizar seus sonhos.

Me conta: qual é seu MAIOR objetivo financeiro agora?
```

## Troubleshooting Common Issues

### Reset Not Working
**Problem**: AI remembers previous conversation context
**Root Cause**: Phone number format mismatch (+5511... vs 5511...)
**Solution**: Use direct database reset with user ID

```javascript
// Emergency reset procedure
const userId = await findUserIdDirectly();
await DevTools.resetUserById(userId);
```

### Duplicate Users
**Problem**: User created with different phone formats
**Detection**: Multiple user records for same person
**Solution**: Manual database cleanup + standardize phone format

### Date Calculation Errors
**Problem**: AI calculates dates incorrectly
**Solution**: Include temporal context in system prompt
```javascript
CONTEXTO TEMPORAL: Estamos em julho de 2025. Use isso para calcular datas futuras corretamente.
```

### No Welcome Message
**Problem**: New users don't receive welcome message
**Check**: Verify outbound message count is 0
**Debug**: Use `/dev/messages/debug/:userId` endpoint

## Key Architecture Benefits

1. **Simplicity**: Single-purpose services are easier to debug and maintain
2. **Reliability**: Fewer dependencies and state transitions reduce failure points
3. **Focus**: AI has one clear mission instead of multiple competing objectives
4. **Testability**: Clean service boundaries enable isolated testing
5. **Performance**: Direct method calls eliminate event bus overhead
6. **Debuggability**: Clear call flow makes issue diagnosis straightforward