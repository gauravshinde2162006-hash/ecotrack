describe('dashboard route module', () => {
  it('should export an Express router', () => {
    const router = require('./dashboard');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect(router.stack).toBeDefined();
  });

  it('should have GET / route', () => {
    const router = require('./dashboard');
    const routes = router.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/');
  });

  it('should have GET /pie route', () => {
    const router = require('./dashboard');
    const routes = router.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/pie');
  });

  it('should have GET /trend route', () => {
    const router = require('./dashboard');
    const routes = router.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/trend');
  });
});