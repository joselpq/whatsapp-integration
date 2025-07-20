// Temporary endpoint to setup database on Railway
// Add this to server.js temporarily

const express = require('express');
const router = express.Router();

// One-time database setup endpoint
router.get('/setup-database-now', async (req, res) => {
  try {
    const setupDb = require('./scripts/setup-db');
    await setupDb();
    res.json({ 
      success: true, 
      message: 'Database setup completed!',
      warning: 'REMOVE THIS ENDPOINT AFTER USE'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;