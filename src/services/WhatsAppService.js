const axios = require('axios');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

class WhatsAppService {
  constructor() {
    this.accessToken = process.env.TEST_ACCESS_TOKEN;
    this.phoneNumberId = process.env.TEST_PHONE_NUMBER_ID;
    this.businessNumber = process.env.BUSINESS_PHONE_NUMBER || '+5511939041011';
    this.apiVersion = 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  async sendMessage(to, content, options = {}) {
    try {
      // Find or create user
      const user = await User.findOrCreate(to);
      
      // Find or create conversation
      const conversation = await Conversation.findOrCreate(user.id, to);
      
      // Check if we can send free message
      const conversationStatus = await Conversation.getStatus(user.id);
      const canSendFreeMessage = conversationStatus.canSendFreeMessage;
      
      // Determine message type
      const messageType = options.forceTemplate || !canSendFreeMessage ? 'template' : 'free';
      
      let response;
      if (messageType === 'template') {
        if (!options.templateName) {
          throw new Error('Template name required for template messages');
        }
        response = await this.sendTemplateMessage(to, options.templateName, options.templateLanguage, options.templateComponents);
      } else {
        response = await this.sendTextMessage(to, content);
      }

      // Store message in database
      await Message.create({
        whatsappMessageId: response.messages[0].id,
        conversationId: conversation.id,
        userId: user.id,
        direction: 'outbound',
        fromNumber: this.businessNumber,
        toNumber: to,
        messageType: messageType === 'template' ? 'template' : 'text',
        content: messageType === 'template' ? {
          templateName: options.templateName,
          language: options.templateLanguage,
          components: options.templateComponents
        } : { text: content },
        templateName: options.templateName,
        status: 'sent'
      });

      return {
        success: true,
        messageId: response.messages[0].id,
        messageType,
        conversationWindow: conversationStatus
      };

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendTextMessage(to, text) {
    try {
      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error sending text message:', error.response?.data || error.message);
      throw new Error(`Failed to send message: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async sendTemplateMessage(to, templateName, languageCode = 'pt_BR', components = []) {
    try {
      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error sending template message:', error.response?.data || error.message);
      throw new Error(`Failed to send template: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async sendMedia(to, mediaType, mediaUrl, caption = '') {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl
      }
    };

    if (caption && (mediaType === 'image' || mediaType === 'video')) {
      payload[mediaType].caption = caption;
    }

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async processIncomingMessage(webhookData) {
    try {
      const { messages, statuses } = webhookData;

      // Process incoming messages
      if (messages) {
        for (const message of messages) {
          await this.handleIncomingMessage(message, webhookData.metadata);
        }
      }

      // Process status updates
      if (statuses) {
        for (const status of statuses) {
          await this.handleStatusUpdate(status);
        }
      }

    } catch (error) {
      console.error('Error processing incoming message:', error);
      throw error;
    }
  }

  async handleIncomingMessage(message, metadata) {
    try {
      // Find or create user
      const user = await User.findOrCreate(message.from);
      
      // Find or create conversation
      const conversation = await Conversation.findOrCreate(user.id, message.from);
      
      // Update conversation window (user sent message = 24h window opens)
      const messageTime = new Date(parseInt(message.timestamp) * 1000);
      await Conversation.updateWindow(conversation.id, messageTime);
      
      // Store message
      await Message.create({
        whatsappMessageId: message.id,
        conversationId: conversation.id,
        userId: user.id,
        direction: 'inbound',
        fromNumber: message.from,
        toNumber: metadata.phone_number_id,
        messageType: message.type,
        content: this.extractMessageContent(message),
        status: 'received'
      });

      // Process the message and send response
      await this.processAndRespond(user, conversation, message);

    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  async handleStatusUpdate(status) {
    try {
      await Message.updateStatus(status.id, status.status);
    } catch (error) {
      console.error('Error handling status update:', error);
    }
  }

  extractMessageContent(message) {
    const content = { type: message.type };
    
    switch (message.type) {
      case 'text':
        content.text = message.text.body;
        break;
      case 'image':
        content.image = message.image;
        break;
      case 'document':
        content.document = message.document;
        break;
      case 'audio':
        content.audio = message.audio;
        break;
      case 'video':
        content.video = message.video;
        break;
      default:
        content.raw = message;
    }
    
    return content;
  }

  async processAndRespond(user, conversation, message) {
    try {
      // Basic auto-response logic (will be replaced by AI later)
      const messageText = message.text?.body?.toLowerCase() || '';
      
      let responseText = '';
    
    if (messageText.includes('oi') || messageText.includes('olá') || messageText.includes('hello')) {
      responseText = `Oi! Sou o Arnaldo, seu assistente financeiro pessoal 🌟\n\nVou te ajudar a organizar suas finanças em 3 passos simples:\n\n1️⃣ Entender sua situação atual\n2️⃣ Definir suas metas\n3️⃣ Criar um plano personalizado\n\nVamos começar? Me conta: qual sua maior preocupação com dinheiro hoje?`;
    } else if (messageText.includes('help') || messageText.includes('ajuda')) {
      responseText = `Posso te ajudar com:\n\n💰 Controle de gastos\n📊 Planejamento financeiro\n🎯 Metas de economia\n📱 Dicas personalizadas\n\nO que você gostaria de saber?`;
    } else if (messageText.includes('obrigad') || messageText.includes('valeu')) {
      responseText = `De nada! Estou aqui para te ajudar sempre que precisar 😊\n\nLembre-se: pequenos passos levam a grandes conquistas financeiras!`;
    } else {
      responseText = `Entendi! Você disse: "${message.text?.body}"\n\nEstou aqui para te ajudar com suas finanças. Pode me contar mais sobre sua situação financeira atual?`;
    }

      // Send response
      await this.sendMessage(user.phone_number, responseText);
      
    } catch (error) {
      console.error('Error in processAndRespond:', error);
      // Don't throw - we don't want to crash the webhook handler
    }
  }
}

module.exports = WhatsAppService;