const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Message {
  static async create(messageData) {
    const {
      whatsappMessageId,
      conversationId,
      userId,
      direction,
      fromNumber,
      toNumber,
      messageType,
      content,
      templateName = null,
      status = 'sent'
    } = messageData;

    const id = uuidv4();
    
    const query = `
      INSERT INTO messages (
        id, whatsapp_message_id, conversation_id, user_id, direction,
        from_number, to_number, message_type, content, template_name, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id, whatsappMessageId, conversationId, userId, direction,
      fromNumber, toNumber, messageType, JSON.stringify(content), templateName, status
    ]);
    
    return result.rows[0];
  }

  static async updateStatus(whatsappMessageId, status) {
    const query = `
      UPDATE messages 
      SET status = $2, updated_at = NOW()
      WHERE whatsapp_message_id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [whatsappMessageId, status]);
    return result.rows[0];
  }

  static async findByConversation(conversationId, limit = 50, offset = 0) {
    const query = `
      SELECT m.*, u.phone_number as user_phone_number, u.first_name, u.last_name
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [conversationId, limit, offset]);
    return result.rows.map(row => ({
      ...row,
      content: JSON.parse(row.content)
    }));
  }

  static async findByUser(userId, limit = 50, offset = 0) {
    const query = `
      SELECT m.*, c.phone_number as conversation_phone
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.user_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [userId, limit, offset]);
    return result.rows.map(row => ({
      ...row,
      content: JSON.parse(row.content)
    }));
  }

  static async getRecentByUser(userId, hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const query = `
      SELECT m.*, c.phone_number as conversation_phone
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.user_id = $1 AND m.created_at >= $2
      ORDER BY m.created_at DESC
    `;
    
    const result = await db.query(query, [userId, since]);
    return result.rows.map(row => ({
      ...row,
      content: JSON.parse(row.content)
    }));
  }

  static async getStats() {
    const query = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_messages,
        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_messages,
        COUNT(CASE WHEN message_type = 'template' THEN 1 END) as template_messages,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT conversation_id) as unique_conversations
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;
    
    const result = await db.query(query);
    return result.rows[0];
  }
}

module.exports = Message;