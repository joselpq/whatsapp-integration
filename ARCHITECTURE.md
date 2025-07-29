# WhatsApp Financial Assistant Architecture

## Overview
Our architecture follows a simplified, focused design with clear separation of concerns. The system implements a **two-phase conversation orchestration** with seamless transitions between specialized AI agents: Goal Discovery → Monthly Expenses Discovery.

## Core Principles
1. **Orchestrated Conversations**: Two-phase flow with intelligent transitions between specialized agents
2. **Clean Separation**: Messaging infrastructure is completely separate from business logic
3. **Context Preservation**: Full conversation history is passed to AI agents for better understanding
4. **State-Based Routing**: Simple but robust conversation state management for seamless transitions

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
- **Goal Confirmation**: Asks "Podemos considerar este objetivo e seguir para a próxima etapa?" when goal is clear

### ArnaldoMonthlyExpenses.js
**Mission**: AI service focused on discovering and organizing user's monthly expenses

**Responsibilities:**
- Discover ALL monthly expenses across major categories (housing, food, transport, etc.)
- Help users estimate costs when they don't know exact amounts
- Organize expenses from highest to lowest
- Provide final expenses summary when complete

**Key Features:**
- Uses OpenAI GPT-4o with temperature 0.3, max_tokens 300 (more focused responses)
- Category-based expense discovery (housing, food, transport, health, education, etc.)
- Estimation assistance for users with low financial literacy
- **Completion Signal**: Says "Então essa é a estimativa dos seus custos mensais:" when done

### ConversationOrchestrator.js (**NEW**)
**Mission**: **Central Conversation Orchestration Engine** - Manages all conversation flow logic

**Responsibilities:**
- **Phase Detection**: Uses ConversationStateDetector to determine current phase
- **Phase Routing**: Routes messages to appropriate phase handlers
- **Error Handling**: Centralized error management with user-friendly fallbacks
- **Extensibility**: Easy addition of new conversation phases

**Architecture:**
```javascript
// Phase-based architecture with pluggable components
const phases = new Map([
  ['welcome', new WelcomePhase(messagingService, stateDetector)],
  ['goal_discovery', new GoalDiscoveryPhase(messagingService, stateDetector)],
  ['monthly_expenses', new MonthlyExpensesPhase(messagingService, stateDetector)],
  ['complete', new CompletePhase(messagingService, stateDetector)]
]);
```

### ArnaldoAgent.js
**Mission**: **Orchestration Facade** - Simplified interface to conversation system

**Responsibilities:**
- **Delegation**: Forwards all conversation logic to ConversationOrchestrator
- **Backward Compatibility**: Maintains existing API for server.js
- **Service Access**: Provides messaging service access

**Simplified Implementation:**
```javascript
class ArnaldoAgent {
  constructor() {
    this.messagingService = new WhatsAppMessagingService();
    this.orchestrator = new ConversationOrchestrator(this.messagingService);
  }

  async processIncomingMessage(messageInfo) {
    // Simply delegate to orchestrator
    return await this.orchestrator.processMessage(messageInfo);
  }
}
```

### Phase Components (**NEW**)

**ConversationPhase** - Base class for all conversation phases
- Abstract interface for phase implementations
- Common utilities (affirmative response checking)
- Enforces consistent phase structure

**Phase Implementations:**
1. **WelcomePhase** - Sends welcome message, transitions to goal discovery
2. **GoalDiscoveryPhase** - Manages goal discovery and confirmation logic
3. **MonthlyExpensesPhase** - Handles expense tracking conversations
4. **CompletePhase** - Handles completed conversations (no response)

**ConversationStateDetector** - Centralized state detection
- Extracted from ArnaldoAgent for reusability
- Detects conversation phase based on message history
- Provides utilities like `getLastOutboundMessage()`

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

## Message Flow Architecture - Two-Phase Orchestration

```
                    Incoming WhatsApp Message
                              ↓
                     [WhatsApp Webhook] server.js
                              ↓
              WhatsAppMessagingService.storeIncomingMessage()
                              ↓
                 ArnaldoAgent.processIncomingMessage()
                              ↓
                    [ORCHESTRATION ENGINE]
                              ↓
               ┌──────────────────────────────────────┐
               │         Phase Detection              │
               │  1. Check if first message           │
               │  2. Get conversation state           │
               │  3. Determine current phase          │
               └──────────────┬───────────────────────┘
                              ↓
                 ┌─────────────────────────────┐
                 │  PHASE 1: Welcome Message   │
                 │  if (isFirstMessage)        │
                 │    → Send Welcome           │
                 └─────────────┬───────────────┘
                              ↓
                 ┌─────────────────────────────┐
                 │  PHASE 2: Goal Discovery    │
                 │  if (!goalComplete)         │
                 │    → Route to GoalAI        │ → OpenAI GPT-4o
                 │    → Check for confirmation │   Goal Discovery
                 │    → Send transition msg    │      ↓
                 └─────────────┬───────────────┘   AI Response
                              ↓                      ↓
                 ┌─────────────────────────────┐      ↓
                 │ PHASE 3: Monthly Expenses   │      ↓
                 │ if (!expensesComplete)      │      ↓
                 │   → Route to ExpensesAI     │ → OpenAI GPT-4o
                 │   → Check for completion    │   Expenses Discovery
                 └─────────────┬───────────────┘      ↓
                              ↓                   AI Response
                 ┌─────────────────────────────┐      ↓
                 │  PHASE 4: Complete          │      ↓
                 │  → No more responses        │      ↓
                 └─────────────────────────────┘      ↓
                                                     ↓
                              WhatsAppMessagingService.sendMessage()
                                        ↓
                                 User receives response
```

## Conversation State Management

**Phase-Based State Model:**
The system uses intelligent state detection based on conversation content analysis and message patterns.

```javascript
// State Detection Logic
const conversationState = {
  goalComplete: checkForTransitionMessage(),     // "Perfeito! Agora vamos entender..."
  expensesComplete: checkForExpensesSummary()    // "Então essa é a estimativa..."
};

// Phase Routing Logic
if (isFirstMessage) → Phase 1: Welcome
else if (!goalComplete) → Phase 2: Goal Discovery
else if (!expensesComplete) → Phase 3: Monthly Expenses  
else → Phase 4: Conversation Complete (no response)
```

**Key State Indicators:**
- **First Message Detection**: `outbound_message_count === 0`
- **Goal Completion**: Presence of transition message in conversation history
- **Expenses Completion**: Presence of expenses summary message in conversation history
- **Conversation Window**: 24-hour WhatsApp conversation limit tracking
- **Full Context**: Complete message history passed to AI agents

**Critical State Transition Points:**
1. **Goal → Expenses Transition**: When user confirms goal with affirmative response
2. **Expenses → Complete**: When AI provides final expenses summary
3. **Window Expiry**: Conversation requires template messages after 24 hours

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
│   ├── orchestration/                    # NEW: Conversation orchestration layer
│   │   ├── ConversationOrchestrator.js  # Main orchestration engine
│   │   ├── ConversationPhase.js         # Base phase class
│   │   ├── ConversationStateDetector.js # State detection logic
│   │   └── phases/                      # Phase implementations
│   │       ├── WelcomePhase.js          # Welcome message phase
│   │       ├── GoalDiscoveryPhase.js    # Goal discovery phase
│   │       ├── MonthlyExpensesPhase.js  # Expenses tracking phase
│   │       └── CompletePhase.js         # Completion phase
│   ├── services/
│   │   ├── ArnaldoGoalDiscovery.js      # AI goal discovery service
│   │   ├── ArnaldoMonthlyExpenses.js    # AI expenses service
│   │   ├── ArnaldoAgent.js              # Orchestration facade
│   │   └── WhatsAppMessagingService.js  # Pure messaging
│   ├── models/                          # Database models
│   ├── database/                        # DB connection
│   └── utils/
│       └── dev-tools.js                 # Development utilities
├── server.js                            # Main webhook handler
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

## Orchestration Pattern Design (**IMPLEMENTED** ✅)

The **ConversationOrchestrator** pattern has been fully implemented, providing clean separation between conversation routing and phase logic:

### Implemented Architecture Benefits
1. **Centralized Control**: All conversation flow logic in ConversationOrchestrator  
2. **Extensible**: New phases can be added by creating a phase class and adding to the Map
3. **Testable**: Each phase is independently testable
4. **Maintainable**: Clear separation between orchestration, phases, and services
5. **Reusable**: ConversationStateDetector can be used by any component

### Adding New Conversation Phases

To add a new conversation phase:

1. **Create Phase Class**:
```javascript
class NewPhase extends ConversationPhase {
  getName() { return 'new_phase'; }
  async process(messageInfo) { /* phase logic */ }
}
```

2. **Add to Orchestrator**:
```javascript
this.phases.set('new_phase', new NewPhase(messagingService, stateDetector));
```

3. **Update State Detection**:
```javascript
// In ConversationStateDetector.detectPhase()
if (/* condition for new phase */) {
  return 'new_phase';
}
```

### Migration from Complex Architecture

The implementation successfully migrated from:
- **Before**: Complex state machines, event buses, multiple supervisors
- **After**: Simple phase-based routing with clear responsibilities

This architecture is now production-ready and actively handling conversations!

## Troubleshooting Common Issues

### Conversation Transition Errors
**Problem**: Technical error fallback after second message
**Root Cause**: JSON parsing issue in `_getLastOutboundMessage()`
**Solution**: Message content stored as JSON but accessed as string
```javascript
// Fixed in _getLastOutboundMessage()
let content = result.rows[0].content;
if (typeof content === 'string') {
  try {
    const parsed = JSON.parse(content);
    content = parsed.text || parsed.body || content;
  } catch (e) { /* use as-is */ }
}
```

### Reset Not Working
**Problem**: AI remembers previous conversation context
**Root Cause**: Phone number format mismatch (+5511... vs 5511...)
**Solution**: Use direct database reset with user ID

### Template Message Errors
**Problem**: "Template name required for template messages"
**Root Cause**: Conversation window expired (24-hour limit)
**Solution**: User must send new message to reopen window

### Date Calculation Errors
**Problem**: AI calculates dates incorrectly
**Solution**: Include temporal context in system prompt
```javascript
CONTEXTO TEMPORAL: Estamos em julho de 2025. Use isso para calcular datas futuras corretamente.
```

## Key Architecture Benefits

1. **Simplicity**: Single-purpose services are easier to debug and maintain
2. **Reliability**: Fewer dependencies and state transitions reduce failure points
3. **Focus**: AI has one clear mission instead of multiple competing objectives
4. **Testability**: Clean service boundaries enable isolated testing
5. **Performance**: Direct method calls eliminate event bus overhead
6. **Debuggability**: Clear call flow makes issue diagnosis straightforward