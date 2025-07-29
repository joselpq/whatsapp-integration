# ConversationOrchestrator Component Design

## Overview

The `ConversationOrchestrator` is a proposed architectural enhancement to further encapsulate and modularize the conversation flow logic currently embedded in `ArnaldoAgent.js`.

## Current Architecture Issues

While the current `ArnaldoAgent` orchestration works well, it has some areas for improvement:

1. **Single Responsibility Violation**: ArnaldoAgent handles both orchestration AND phase-specific logic
2. **Hard to Test**: Phase logic is embedded within orchestration logic
3. **Limited Extensibility**: Adding new phases requires modifying core orchestration code
4. **Mixed Concerns**: State detection, routing, and business logic are intertwined

## Proposed Architecture

### ConversationOrchestrator Class

```javascript
class ConversationOrchestrator {
  constructor(messagingService) {
    this.messagingService = messagingService;
    this.phases = new Map([
      ['welcome', new WelcomePhase(messagingService)],
      ['goal_discovery', new GoalDiscoveryPhase(messagingService)], 
      ['monthly_expenses', new MonthlyExpensesPhase(messagingService)],
      ['complete', new CompletePhase(messagingService)]
    ]);
    this.stateDetector = new ConversationStateDetector();
  }
  
  async processMessage(messageInfo) {
    try {
      // Detect current phase
      const currentPhase = await this.detectPhase(messageInfo.userId);
      
      // Get phase handler
      const phaseHandler = this.phases.get(currentPhase);
      if (!phaseHandler) {
        throw new Error(`Unknown phase: ${currentPhase}`);
      }
      
      // Process message through phase handler
      const result = await phaseHandler.process(messageInfo);
      
      // Handle phase transitions
      if (result.transitionTo) {
        await this.handleTransition(messageInfo.userId, currentPhase, result.transitionTo);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Orchestration error:', error);
      return await this.handleError(messageInfo, error);
    }
  }
  
  async detectPhase(userId) {
    return await this.stateDetector.detectPhase(userId);
  }
  
  async handleTransition(userId, fromPhase, toPhase) {
    console.log(`🔄 Transitioning user ${userId}: ${fromPhase} → ${toPhase}`);
    // Additional transition logic if needed
  }
  
  async handleError(messageInfo, error) {
    await this.messagingService.sendMessage(
      messageInfo.phoneNumber,
      'Ops! Tive um probleminha técnico. Pode repetir sua mensagem? 🤔'
    );
    
    return {
      processed: false,
      error: error.message,
      phase: 'error'
    };
  }
}
```

### Phase Interface

Each phase implements a common interface:

```javascript
class ConversationPhase {
  constructor(messagingService) {
    this.messagingService = messagingService;
  }
  
  async process(messageInfo) {
    throw new Error('process() must be implemented by subclass');
  }
  
  async canHandle(messageInfo) {
    throw new Error('canHandle() must be implemented by subclass');
  }
}
```

### Phase Implementations

#### WelcomePhase

```javascript
class WelcomePhase extends ConversationPhase {
  async process(messageInfo) {
    const welcomeMessage = `Oi! Sou o Arnaldo, seu consultor financeiro pessoal! 👋

Vou te ajudar a organizar suas finanças e realizar seus sonhos.

Me conta: qual é seu MAIOR objetivo financeiro agora?

Pode ser qualquer coisa:
💰 Criar reserva de emergência
🏠 Comprar casa, carro, celular...
💳 Quitar dívidas
💡 Economizar mais dinheiro
🎓 Fazer curso, viagem...
🤷 Não sei bem ainda

Me fala com suas palavras!`;

    await this.messagingService.sendMessage(messageInfo.phoneNumber, welcomeMessage);
    
    return {
      processed: true,
      phase: 'welcome',
      sentMessage: true,
      transitionTo: 'goal_discovery'
    };
  }
  
  async canHandle(messageInfo) {
    // Check if this is first message
    return await this._isFirstMessage(messageInfo.userId);
  }
}
```

#### GoalDiscoveryPhase

```javascript
class GoalDiscoveryPhase extends ConversationPhase {
  constructor(messagingService) {
    super(messagingService);
    this.goalDiscoveryAI = new ArnaldoGoalDiscovery();
  }
  
  async process(messageInfo) {
    // Check if user is confirming goal
    const lastMessage = await this._getLastOutboundMessage(messageInfo.userId);
    const askedGoalConfirmation = lastMessage && lastMessage.includes('Podemos considerar este objetivo e seguir para a próxima etapa?');
    
    if (askedGoalConfirmation && this._isAffirmativeResponse(messageInfo.content)) {
      // Send transition message
      const transitionMessage = `Perfeito! Agora vamos entender seus gastos mensais para criar um plano de economia eficiente. 📊

Vamos começar: quanto você gasta por mês com moradia (aluguel, financiamento, condomínio)?`;
      
      await this.messagingService.sendMessage(messageInfo.phoneNumber, transitionMessage);
      
      return {
        processed: true,
        phase: 'goal_discovery',
        sentMessage: true,
        transitionTo: 'monthly_expenses',
        goalComplete: true
      };
    } else {
      // Continue goal discovery
      const goalResponse = await this.goalDiscoveryAI.chat(messageInfo.content, messageInfo.userId);
      await this.messagingService.sendMessage(messageInfo.phoneNumber, goalResponse.message);
      
      return {
        processed: true,
        phase: 'goal_discovery',
        sentMessage: true,
        goalComplete: false
      };
    }
  }
  
  async canHandle(messageInfo) {
    const state = await this._getConversationState(messageInfo.userId);
    return !state.goalComplete;
  }
}
```

#### MonthlyExpensesPhase

```javascript
class MonthlyExpensesPhase extends ConversationPhase {
  constructor(messagingService) {
    super(messagingService);
    this.monthlyExpensesAI = new ArnaldoMonthlyExpenses();
  }
  
  async process(messageInfo) {
    const expenseResponse = await this.monthlyExpensesAI.processMessage(
      messageInfo.phoneNumber, 
      messageInfo.content
    );
    
    await this.messagingService.sendMessage(messageInfo.phoneNumber, expenseResponse.response);
    
    if (expenseResponse.expensesComplete) {
      return {
        processed: true,
        phase: 'monthly_expenses',
        sentMessage: true,
        transitionTo: 'complete',
        expensesComplete: true
      };
    } else {
      return {
        processed: true,
        phase: 'monthly_expenses',
        sentMessage: true,
        expensesComplete: false
      };
    }
  }
  
  async canHandle(messageInfo) {
    const state = await this._getConversationState(messageInfo.userId);
    return state.goalComplete && !state.expensesComplete;
  }
}
```

#### CompletePhase

```javascript
class CompletePhase extends ConversationPhase {
  async process(messageInfo) {
    // Conversation is complete - no response needed
    return {
      processed: false,
      phase: 'complete',
      reason: 'conversation_complete',
      sentMessage: false
    };
  }
  
  async canHandle(messageInfo) {
    const state = await this._getConversationState(messageInfo.userId);
    return state.goalComplete && state.expensesComplete;
  }
}
```

### ConversationStateDetector

```javascript
class ConversationStateDetector {
  async detectPhase(userId) {
    // Check if first message
    if (await this._isFirstMessage(userId)) {
      return 'welcome';
    }
    
    // Get conversation state
    const state = await this._getConversationState(userId);
    
    if (!state.goalComplete) {
      return 'goal_discovery';
    } else if (!state.expensesComplete) {
      return 'monthly_expenses';
    } else {
      return 'complete';
    }
  }
  
  async _isFirstMessage(userId) {
    // Implementation from current ArnaldoAgent
  }
  
  async _getConversationState(userId) {
    // Implementation from current ArnaldoAgent
  }
}
```

## Benefits of This Architecture

### 1. **Single Responsibility**
- `ConversationOrchestrator`: Only handles routing and transitions
- Each `Phase`: Only handles its specific conversation logic
- `StateDetector`: Only handles phase detection

### 2. **Testability**
```javascript
// Easy to test phases in isolation
const welcomePhase = new WelcomePhase(mockMessagingService);
const result = await welcomePhase.process(mockMessageInfo);
expect(result.transitionTo).toBe('goal_discovery');
```

### 3. **Extensibility**
```javascript
// Easy to add new phases
orchestrator.phases.set('financial_planning', new FinancialPlanningPhase(messagingService));
```

### 4. **Maintainability**
- Each phase is self-contained
- Clear separation of concerns
- Easy to debug specific phase issues

### 5. **Reusability**
- Phases can be reused in different orchestration contexts
- State detection logic is centralized

## Migration Strategy

### Phase 1: Extract State Detection
```javascript
// Move state detection logic to ConversationStateDetector
const stateDetector = new ConversationStateDetector();
```

### Phase 2: Create Phase Classes
```javascript
// Create phase classes with current logic
const welcomePhase = new WelcomePhase(messagingService);
```

### Phase 3: Implement Orchestrator
```javascript
// Replace ArnaldoAgent logic with ConversationOrchestrator
const orchestrator = new ConversationOrchestrator(messagingService);
```

### Phase 4: Update ArnaldoAgent
```javascript
class ArnaldoAgent {
  constructor() {
    this.orchestrator = new ConversationOrchestrator(new WhatsAppMessagingService());
  }
  
  async processIncomingMessage(messageInfo) {
    return await this.orchestrator.processMessage(messageInfo);
  }
}
```

## Implementation Priority

1. **High Priority**: Extract `ConversationStateDetector` (immediate benefit)
2. **Medium Priority**: Create `WelcomePhase` and `GoalDiscoveryPhase` 
3. **Low Priority**: Full `ConversationOrchestrator` implementation

## Conclusion

The `ConversationOrchestrator` pattern would significantly improve the architecture's:
- **Modularity**: Each conversation phase is a separate, testable component
- **Extensibility**: New phases can be added without modifying core logic
- **Maintainability**: Clear separation of concerns makes debugging easier
- **Reusability**: Phases can be composed in different conversation flows

This design preserves the current functionality while providing a cleaner, more maintainable foundation for future conversation flow enhancements.