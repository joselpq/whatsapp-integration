const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Conversation {
  static async findByUserId(userId) {
    const query = `
      SELECT * FROM conversations 
      WHERE user_id = $1 AND status = 'active'
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  static async create(userId, phoneNumber) {
    const id = uuidv4();
    const query = `
      INSERT INTO conversations (id, user_id, phone_number, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *
    `;
    
    const result = await db.query(query, [id, userId, phoneNumber]);
    return result.rows[0];
  }

  static async updateWindow(conversationId, lastUserMessageAt) {
    const windowExpiresAt = new Date(lastUserMessageAt.getTime() + 24 * 60 * 60 * 1000); // +24 hours
    
    const query = `
      UPDATE conversations 
      SET last_user_message_at = $2, window_expires_at = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [conversationId, lastUserMessageAt, windowExpiresAt]);
    return result.rows[0];
  }

  static async isWindowOpen(conversationId) {
    const query = `
      SELECT window_expires_at 
      FROM conversations 
      WHERE id = $1
    `;
    
    const result = await db.query(query, [conversationId]);
    const conversation = result.rows[0];
    
    if (!conversation || !conversation.window_expires_at) {
      return false;
    }
    
    return new Date() < new Date(conversation.window_expires_at);
  }

  static async findOrCreate(userId, phoneNumber) {
    let conversation = await this.findByUserId(userId);
    
    if (!conversation) {
      conversation = await this.create(userId, phoneNumber);
    }
    
    return conversation;
  }

  static async getStatus(userId) {
    const conversation = await this.findByUserId(userId);
    
    if (!conversation) {
      return {
        hasConversation: false,
        isWindowOpen: false,
        canSendFreeMessage: false
      };
    }
    
    const isWindowOpen = await this.isWindowOpen(conversation.id);
    
    return {
      hasConversation: true,
      conversationId: conversation.id,
      isWindowOpen,
      canSendFreeMessage: isWindowOpen,
      windowExpiresAt: conversation.window_expires_at,
      lastUserMessage: conversation.last_user_message_at
    };
  }
}

module.exports = Conversation;