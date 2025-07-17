require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const app = express();

// Middleware to capture raw body for signature verification
app.use(express.json({ 
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Configuration
const config = {
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'zenmind-webhook-2025',
  appSecret: process.env.META_APP_SECRET,
  port: process.env.PORT || 3000
};

// In-memory storage for messages (replace with database later)
const messageStore = [];
const conversations = new Map();

// Webhook verification endpoint (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request:', { mode, token: token ? 'provided' : 'missing' });

  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// Webhook event handler (POST)
app.post('/webhook', (req, res) => {
  // Verify signature if app secret is configured
  if (config.appSecret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!verifySignature(req.rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).send('Unauthorized');
    }
  }

  const body = req.body;
  console.log('📨 Webhook event received:', JSON.stringify(body, null, 2));

  // Process the webhook event
  if (body.object === 'whatsapp_business_account') {
    body.entry?.forEach(entry => {
      entry.changes?.forEach(change => {
        if (change.field === 'messages') {
          processMessages(change.value);
        }
      });
    });
  }

  // Always respond with 200 OK
  res.status(200).send('EVENT_RECEIVED');
});

// API endpoint to get stored messages
app.get('/api/messages', (req, res) => {
  const { userId, limit = 50, offset = 0 } = req.query;
  
  let filteredMessages = messageStore;
  if (userId) {
    filteredMessages = messageStore.filter(msg => msg.userId === userId);
  }
  
  const paginatedMessages = filteredMessages.slice(
    parseInt(offset), 
    parseInt(offset) + parseInt(limit)
  );
  
  res.json({
    messages: paginatedMessages,
    total: filteredMessages.length,
    hasMore: filteredMessages.length > parseInt(offset) + parseInt(limit)
  });
});

// API endpoint to check conversation status
app.get('/api/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const conversation = conversations.get(userId);
  
  if (!conversation) {
    return res.json({
      userId,
      conversationWindow: {
        isOpen: false,
        canSendFreeMessage: false
      }
    });
  }
  
  const now = new Date();
  const windowExpiry = new Date(conversation.lastUserMessageAt);
  windowExpiry.setHours(windowExpiry.getHours() + 24);
  
  res.json({
    userId,
    phoneNumber: conversation.phoneNumber,
    conversationWindow: {
      isOpen: windowExpiry > now,
      expiresAt: windowExpiry.toISOString(),
      lastUserMessage: conversation.lastUserMessageAt,
      canSendFreeMessage: windowExpiry > now
    }
  });
});

// Helper function to verify webhook signature
function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', config.appSecret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Process incoming messages
function processMessages(value) {
  const { messages, statuses, metadata } = value;
  
  // Handle incoming messages
  if (messages) {
    messages.forEach(message => {
      console.log('📥 Incoming message:', message);
      
      // Extract user identifier (using phone number as userId for now)
      const userId = message.from;
      
      // Store message
      const storedMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        messageId: message.id,
        userId,
        direction: 'inbound',
        from: message.from,
        to: metadata.phone_number_id,
        content: {
          type: message.type,
          text: message.text?.body,
          // Add other content types as needed
        },
        timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        status: 'received'
      };
      
      messageStore.push(storedMessage);
      
      // Update conversation window
      updateConversationWindow(userId, message.from);
      
      console.log(`✅ Stored message from ${message.from}`);
    });
  }
  
  // Handle status updates
  if (statuses) {
    statuses.forEach(status => {
      console.log('📊 Status update:', status);
      // Update message status in storage
      const storedMsg = messageStore.find(msg => msg.messageId === status.id);
      if (storedMsg) {
        storedMsg.status = status.status;
        console.log(`✅ Updated status for message ${status.id}: ${status.status}`);
      }
    });
  }
}

// Update conversation window for user
function updateConversationWindow(userId, phoneNumber) {
  conversations.set(userId, {
    phoneNumber,
    lastUserMessageAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  console.log(`🕐 Updated conversation window for user ${userId}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    messagesStored: messageStore.length,
    activeConversations: conversations.size,
    uptime: process.uptime()
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`🚀 WhatsApp webhook server running on port ${config.port}`);
  console.log(`📡 Webhook URL: http://localhost:${config.port}/webhook`);
  console.log(`🔑 Verify Token: ${config.webhookVerifyToken}`);
  console.log(`🔐 App Secret: ${config.appSecret ? 'Configured' : 'Not configured'}`);
});