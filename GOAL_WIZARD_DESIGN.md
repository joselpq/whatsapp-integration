# Enhanced Goal Definition Wizard

## Issues with Current System

Based on user testing, the current goal discovery has critical UX problems:

### 🚨 Critical Issues
1. **Rigid Categories**: 1-4 options don't cover real user needs
2. **No Follow-up**: Incomplete answers aren't explored
3. **Multiple Questions**: Overwhelming users with compound questions  
4. **Lost Context**: Goals get abandoned after income collection
5. **Wrong Category**: "Increase revenue" should be "Save more money"

### 📝 User Feedback Example
```
User: "Quero comprar um carro" (incomplete - no price!)
System: Jumps to income → WRONG!
Should ask: "Que tipo de carro? Qual faixa de preço?"
```

## New Goal Wizard Design

### Phase 1: Open Goal Discovery
```
Arnaldo: "Qual é seu MAIOR objetivo financeiro agora?

Pode ser qualquer coisa:
💰 Criar reserva de emergência
🏠 Comprar casa, carro, celular...
💳 Quitar dívidas ou cartão
💡 Economizar mais dinheiro
📚 Fazer um curso, viagem...
🤷 Não sei bem ainda

Me conta com suas palavras!"
```

**Key Changes:**
- ✅ No forced 1-4 selection
- ✅ Examples inspire but don't limit
- ✅ "Me conta com suas palavras" encourages open response
- ✅ "Economizar" instead of "Aumentar renda"

### Phase 2: Goal Clarification Flow

#### For Purchase Goals (casa, carro, celular, etc.)
```
User: "Quero comprar um carro"
                ↓
State: GOAL_PURCHASE_TYPE
Arnaldo: "Que tipo de carro você tem em mente? 
Pode ser usado, novo, uma marca específica..."
                ↓
User: "Um usado, algo simples"
                ↓  
State: GOAL_PURCHASE_BUDGET
Arnaldo: "Qual faixa de preço você está pensando?
Por exemplo: até 20 mil, entre 30-50 mil..."
                ↓
User: "Uns 30 mil"
                ↓
State: GOAL_PURCHASE_TIMELINE  
Arnaldo: "Quando você gostaria de comprar?
Em 6 meses, 1 ano, 2 anos?"
                ↓
User: "1 ano"
                ↓
State: GOAL_COMPLETE
Creates: Goal(type: purchase, item: "carro usado", amount: 30000, timeline: "1 ano")
```

#### For Emergency Fund
```
User: "Quero criar uma reserva"
                ↓
State: GOAL_EMERGENCY_MONTHS
Arnaldo: "Quantos meses de gastos você quer guardar?
3 meses = segurança básica
6 meses = boa proteção  
12 meses = muito seguro"
                ↓
User: "6 meses"
                ↓
State: GOAL_EMERGENCY_CURRENT
Arnaldo: "Você já tem algum dinheiro guardado?
Pode ser na poupança, conta corrente..."
                ↓
User: "Tenho uns 500 reais"
                ↓  
State: GOAL_COMPLETE
Creates: Goal(type: emergency, months: 6, current_amount: 500)
```

#### For Debt Payment
```
User: "Quero quitar minhas dívidas"
                ↓
State: GOAL_DEBT_AMOUNT
Arnaldo: "Quanto você deve no total?
Cartão, financiamentos, empréstimos..."
                ↓
User: "15 mil no cartão"
                ↓
State: GOAL_DEBT_PRIORITY  
Arnaldo: "Esse é seu foco principal?
Tem outras dívidas ou só essa?"
                ↓
User: "Só essa mesmo"
                ↓
State: GOAL_COMPLETE
Creates: Goal(type: debt, amount: 15000, description: "cartão")
```

#### For Savings Goals
```
User: "Quero economizar mais"
                ↓
State: GOAL_SAVINGS_PURPOSE
Arnaldo: "Economizar para quê?
Um objetivo específico ou só aumentar a reserva?"
                ↓
User: "Para ter mais segurança"
                ↓
State: GOAL_SAVINGS_AMOUNT
Arnaldo: "Quanto você gostaria de economizar por mês?
R$100, R$300, R$500..."
                ↓
User: "300 por mês"
                ↓
State: GOAL_COMPLETE  
Creates: Goal(type: savings, monthly_target: 300, purpose: "segurança")
```

#### For Open/Unknown Goals
```
User: "Não sei bem"
                ↓
State: GOAL_DISCOVERY_HELP
Arnaldo: "Sem problemas! Vamos descobrir juntos.

O que mais te preocupa com dinheiro hoje?
- Falta de reserva para emergências?
- Dificuldade para comprar algo que quer?
- Dívidas pesando no orçamento?
- Dinheiro acaba antes do mês?"
                ↓
User: "O dinheiro sempre acaba"
                ↓  
State: GOAL_SAVINGS_FOCUS
Arnaldo: "Entendi. Vamos focar em fazer seu dinheiro render mais.
Primeira meta: conseguir sobrar R$200 todo mês.
Topa esse desafio?"
```

### Phase 3: Goal Validation & Summary
```
State: GOAL_COMPLETE
Arnaldo: "🎯 SEU OBJETIVO FINANCEIRO

Comprar: Carro usado (~R$30.000)
Prazo: 1 ano  
Meta mensal: R$2.500 de economia

Vamos criar seu plano para chegar lá! 
Primeiro preciso entender sua renda..."
```

## Technical Implementation

### Enhanced State Machine
```javascript
// Add new goal sub-states
GOAL_PURCHASE_TYPE: 'goal_purchase_type',
GOAL_PURCHASE_BUDGET: 'goal_purchase_budget', 
GOAL_PURCHASE_TIMELINE: 'goal_purchase_timeline',
GOAL_EMERGENCY_MONTHS: 'goal_emergency_months',
GOAL_EMERGENCY_CURRENT: 'goal_emergency_current',
GOAL_DEBT_AMOUNT: 'goal_debt_amount',
GOAL_DEBT_PRIORITY: 'goal_debt_priority',
GOAL_SAVINGS_PURPOSE: 'goal_savings_purpose',
GOAL_SAVINGS_AMOUNT: 'goal_savings_amount',
GOAL_DISCOVERY_HELP: 'goal_discovery_help',
GOAL_COMPLETE: 'goal_complete'
```

### Enhanced Goal Model
```javascript
// Extended goal structure
{
  userId: string,
  type: 'purchase' | 'emergency' | 'debt' | 'savings' | 'other',
  
  // Purchase goals
  item?: string,           // "carro usado"
  amount?: number,         // 30000
  timeline?: string,       // "1 ano"
  
  // Emergency goals  
  months?: number,         // 6
  current_amount?: number, // 500
  
  // Debt goals
  description?: string,    // "cartão de crédito"
  
  // Savings goals
  monthly_target?: number, // 300
  purpose?: string,        // "segurança"
  
  // Metadata
  status: 'active' | 'completed' | 'paused',
  created_at: Date,
  target_date?: Date
}
```

### Natural Language Processing
```javascript
// Enhanced goal detection
class GoalParser {
  static parseGoalType(message) {
    const text = message.toLowerCase();
    
    // Purchase indicators
    if (text.match(/comprar|compra|adquirir|casa|carro|celular|notebook/)) {
      return { type: 'purchase', confidence: 0.9 };
    }
    
    // Emergency fund indicators  
    if (text.match(/reserva|emergência|guardar|poupança/)) {
      return { type: 'emergency', confidence: 0.8 };
    }
    
    // Debt indicators
    if (text.match(/dívida|quitar|pagar|cartão|financiamento/)) {
      return { type: 'debt', confidence: 0.9 };
    }
    
    // Savings indicators
    if (text.match(/economizar|sobrar|juntar|guardar/)) {
      return { type: 'savings', confidence: 0.7 };
    }
    
    return { type: 'unknown', confidence: 0.0 };
  }
  
  static extractAmount(message) {
    // Extract monetary values: "30 mil", "R$15000", "quinze mil"
    const patterns = [
      /(\d+)\s*mil/i,          // "30 mil"
      /r\$?\s*(\d+)/i,         // "R$30000"  
      /(\d+)\s*reais/i,        // "30000 reais"
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        let amount = parseInt(match[1]);
        if (message.includes('mil')) amount *= 1000;
        return amount;
      }
    }
    
    return null;
  }
}
```

## Key Benefits

### 🎯 User Experience
- ✅ **Flexible**: Accepts any goal format
- ✅ **Conversational**: One question at a time
- ✅ **Complete**: Gathers all needed details
- ✅ **Contextual**: Remembers and builds on previous answers

### 🔧 Technical Benefits  
- ✅ **Maintainable**: Clear state transitions
- ✅ **Testable**: Each state can be unit tested
- ✅ **Extensible**: Easy to add new goal types
- ✅ **Robust**: Handles edge cases and incomplete answers

### 📊 Business Benefits
- ✅ **Higher Completion**: More users finish onboarding
- ✅ **Better Data**: Rich goal context for personalization
- ✅ **User Satisfaction**: Feels natural and helpful
- ✅ **Actionable Plans**: Goals with specific targets and timelines

## Implementation Priority

1. **High Priority**: Purchase and Emergency goals (80% of use cases)
2. **Medium Priority**: Debt and Savings goals  
3. **Low Priority**: Open-ended and discovery flows

This design fixes all the identified issues while maintaining the existing infrastructure!