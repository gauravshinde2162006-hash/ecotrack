describe('auth route module', () => {
  it('should export an Express router', () => {
    const authRouter = require('./auth');
    expect(authRouter).toBeDefined();
    expect(typeof authRouter).toBe('function');
    expect(authRouter.stack).toBeDefined(); // Express routers have a stack
  });

  it('should have POST /google route', () => {
    const authRouter = require('./auth');
    const postRoutes = authRouter.stack
      .filter(layer => layer.route && layer.route.methods.post)
      .map(layer => layer.route.path);
    expect(postRoutes).toContain('/google');
  });

  it('should have GET /me route', () => {
    const authRouter = require('./auth');
    const getRoutes = authRouter.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(getRoutes).toContain('/me');
  });
});