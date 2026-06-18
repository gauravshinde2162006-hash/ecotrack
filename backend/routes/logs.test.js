describe('logs route module', () => {
  it('should export an Express router', () => {
    const logsRouter = require('./logs');
    expect(logsRouter).toBeDefined();
    expect(typeof logsRouter).toBe('function');
    expect(logsRouter.stack).toBeDefined();
  });

  it('should have GET /factors route', () => {
    const logsRouter = require('./logs');
    const routes = logsRouter.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/factors');
  });

  it('should have GET /today/status route', () => {
    const logsRouter = require('./logs');
    const routes = logsRouter.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/today/status');
  });

  it('should have GET /range route', () => {
    const logsRouter = require('./logs');
    const routes = logsRouter.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/range');
  });

  it('should have GET /chart route', () => {
    const logsRouter = require('./logs');
    const routes = logsRouter.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/chart');
  });

  it('should have POST / route', () => {
    const logsRouter = require('./logs');
    const routes = logsRouter.stack
      .filter(layer => layer.route && layer.route.methods.post)
      .map(layer => layer.route.path);
    expect(routes).toContain('/');
  });

  it('should have DELETE /:id route', () => {
    const logsRouter = require('./logs');
    const routes = logsRouter.stack
      .filter(layer => layer.route && layer.route.methods.delete)
      .map(layer => layer.route.path);
    expect(routes).toContain('/:id');
  });
});