# WhatsApp Integration Test Guide

## 1. Test Webhook Health
```bash
curl https://whatsapp-integration-production-06bb.up.railway.app/health
```

## 2. Test Sending a Message
Send a test message to your WhatsApp number:

```bash
curl -X POST https://whatsapp-integration-production-06bb.up.railway.app/api/v1/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+5511976196165",
    "content": "Oi! Sou o Arnaldo, seu assistente financeiro. Como posso ajudar?"
  }'
```

## 3. Test WhatsApp Interaction
1. Send a message to +5511939041011 (your business number)
2. Check Railway logs to see if webhook receives it
3. You should get an auto-response from Arnaldo

## 4. Test Conversation Window
1. Send a message and get a response
2. Wait 24+ hours
3. Send another message - should receive template message
4. Reply to continue conversation

## Expected Behaviors:
- First message: Template response (if no prior conversation)
- Reply within 24h: Free-form Arnaldo response
- After 24h: Template message required
- API tracks conversation windows automatically