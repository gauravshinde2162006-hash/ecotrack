const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

describe('authenticateToken middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should fall back to default user when no token is provided', () => {
    authenticateToken(req, res, next);
    expect(req.user).toEqual({ id: 1, name: 'EcoUser' });
    expect(next).toHaveBeenCalled();
  });

  it('should decode a valid JWT token and set req.user', () => {
    const payload = { id: 42, email: 'test@eco.com', name: 'TestUser' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    req.headers['authorization'] = `Bearer ${token}`;

    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(42);
    expect(req.user.email).toBe('test@eco.com');
  });

  it('should return 403 for an invalid token', () => {
    req.headers['authorization'] = 'Bearer invalid.token.here';

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 for an expired token', () => {
    const token = jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: '-1s' });
    req.headers['authorization'] = `Bearer ${token}`;

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 for a token signed with wrong secret', () => {
    const token = jwt.sign({ id: 1 }, 'wrong-secret', { expiresIn: '1h' });
    req.headers['authorization'] = `Bearer ${token}`;

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('JWT_SECRET should be exported as a string', () => {
    expect(typeof JWT_SECRET).toBe('string');
    expect(JWT_SECRET.length).toBeGreaterThan(0);
  });
});