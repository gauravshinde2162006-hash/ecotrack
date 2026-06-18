const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
// Use the environment variable, or a fallback. 
// Note: Google token verification requires the exact Client ID used by the frontend.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy-client-id';
const client = new OAuth2Client(CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    // Verify token with Google
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('[Auth] Google verify error:', err.message);
      return res.status(401).json({ error: 'Invalid Google token. Ensure GOOGLE_CLIENT_ID is correct in backend .env.' });
    }

    const { sub: google_id, email, name, picture: avatar_url } = payload;
    const db = getDb();

    // Check if user exists by Google ID
    let user = await db('users').where({ google_id }).first();

    if (!user) {
      // Check if email exists (e.g. if they started locally)
      user = await db('users').where({ email }).first();
      
      if (user) {
        // Link google account to existing email
        await db('users').where({ id: user.id }).update({ google_id, avatar_url, name });
        user = await db('users').where({ id: user.id }).first();
      } else {
        // Create new user
        const [newId] = await db('users').insert({
          google_id,
          email,
          name,
          avatar_url,
          daily_goal: 5.0
        });
        user = await db('users').where({ id: newId }).first();
      }
    } else {
      // Update avatar or name if they changed on Google
      if (user.avatar_url !== avatar_url || user.name !== name) {
        await db('users').where({ id: user.id }).update({ avatar_url, name });
        user.avatar_url = avatar_url;
        user.name = name;
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, google_id: user.google_id, email: user.email, name: user.name, avatar_url: user.avatar_url },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
