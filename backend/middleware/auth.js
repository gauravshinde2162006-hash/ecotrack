const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ecotrack_super_secret_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // For backward compatibility and development:
  // If no token is provided, fall back to the default local user
  if (!token) {
    req.user = { id: 1, name: 'EcoUser' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('[Auth] Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // { id, google_id, email, name, avatar_url }
    next();
  });
}

module.exports = { authenticateToken, JWT_SECRET };
