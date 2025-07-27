const axios = require('axios');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * Pure messaging service for WhatsApp
 * Responsibilities:
 * - Send messages via WhatsApp API
 * - Store messages in database
 * - Check conversation window status
 * NO business logic, NO decision making about WHAT to send
 */
class WhatsAppMessagingService {
  constructor() {
    this.accessToken = process.env.TEST_ACCESS_TOKEN;
    this.phoneNumberId = process.env.TEST_PHONE_NUMBER_ID;
    this.businessNumber = process.env.BUSINESS_PHONE_NUMBER || '+5511939041011';
    this.apiVersion = 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Send a message to a WhatsApp user
   * @param {string} to - Phone number to send to
   * @param {string} content - Message content
   * @param {object} options - Additional options (forceTemplate, templateName, etc)
   * @returns {object} Message send result
   */
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
        response = await this._sendTemplateMessage(to, options.templateName, options.templateLanguage, options.templateComponents);
      } else {
        response = await this._sendTextMessage(to, content);
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
        conversationWindow: conversationStatus,
        userId: user.id
      };

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Store an incoming message from WhatsApp webhook
   * @param {object} message - WhatsApp message object
   * @param {object} metadata - Webhook metadata
   * @returns {object} Stored message info
   */
  async storeIncomingMessage(message, metadata) {
    try {
      console.log(`📱 Storing incoming message from ${message.from}: ${message.text?.body || message.type}`);
      
      // Find or create user
      const user = await User.findOrCreate(message.from);
      
      // Find or create conversation
      const conversation = await Conversation.findOrCreate(user.id, message.from);
      
      // Update conversation window with latest message timestamp
      await Conversation.updateWindow(conversation.id, new Date());
      
      // Store the incoming message
      const storedMessage = await Message.create({
        whatsappMessageId: message.id,
        conversationId: conversation.id,
        userId: user.id,
        direction: 'inbound',
        fromNumber: message.from,
        toNumber: metadata.phone_number_id,
        messageType: message.type,
        content: this._extractMessageContent(message),
        status: 'received'
      });

      return {
        messageId: storedMessage.id,
        userId: user.id,
        conversationId: conversation.id,
        phoneNumber: message.from,
        content: message.text?.body || null,
        messageType: message.type
      };

    } catch (error) {
      console.error('Error storing incoming message:', error);
      throw error;
    }
  }

  /**
   * Update message status from WhatsApp webhook
   * @param {object} status - Status update object
   */
  async updateMessageStatus(status) {
    try {
      await Message.updateStatus(status.id, status.status);
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  }

  /**
   * Get conversation window status for a phone number
   * @param {string} phoneNumber - Phone number to check
   * @returns {object} Conversation status
   */
  async getConversationStatus(phoneNumber) {
    try {
      const user = await User.findByPhoneNumber(phoneNumber);
      if (!user) {
        return { canSendFreeMessage: false, windowExpired: true };
      }
      
      return await Conversation.getStatus(user.id);
    } catch (error) {
      console.error('Error getting conversation status:', error);
      return { canSendFreeMessage: false, error: error.message };
    }
  }

  /**
   * Get phone number info from WhatsApp
   * @param {string} phoneNumber - Phone number to check
   * @returns {object} Phone info
   */
  async getPhoneInfo(phoneNumber) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting phone info:', error.response?.data || error.message);
      throw error;
    }
  }

  // Private methods

  async _sendTextMessage(to, text) {
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

  async _sendTemplateMessage(to, templateName, language = 'pt_BR', components = []) {
    try {
      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
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

  _extractMessageContent(message) {
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
}

module.exports = WhatsAppMessagingService;