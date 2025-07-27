# Archived Complex Services

This folder contains the old complex architecture files that were replaced during the simplification refactor.

## Files Archived:

- **server-old-complex.js** - Original complex server with multiple responsibilities
- **ConversationSupervisor.js** - Complex state management and validation service
- **OnboardingFlow.js** - Multi-state onboarding flow handler
- **ArnaldoAI.js** - Original AI service with limited context
- **WhatsAppService.js** - Original service mixing messaging and business logic

## Why They Were Replaced:

1. **Too Much Complexity** - Multiple services with overlapping responsibilities
2. **Poor Separation of Concerns** - Business logic mixed with messaging logic
3. **Hard to Debug** - Complex state machines and flows
4. **Difficult to Maintain** - Too many moving parts

## New Simplified Architecture:

- **server.js** (was server-simplified.js) - Clean server with clear separation
- **WhatsAppMessagingService.js** - Pure messaging service (no business logic)
- **ArnaldoAgent.js** - Business logic orchestrator
- **ArnaldoGoalDiscovery.js** - Focused AI service for goal discovery only

## Date Archived:
$(date)

These files are kept for reference but should not be used in the new architecture.