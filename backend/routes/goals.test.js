describe('goals route module', () => {
  it('should export an Express router', () => {
    const router = require('./goals');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect(router.stack).toBeDefined();
  });

  it('should have GET / route', () => {
    const router = require('./goals');
    const routes = router.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/');
  });

  it('should have POST / route for setting goals', () => {
    const router = require('./goals');
    const routes = router.stack
      .filter(layer => layer.route && layer.route.methods.post)
      .map(layer => layer.route.path);
    expect(routes).toContain('/');
  });

  it('should have GET /streak route', () => {
    const router = require('./goals');
    const routes = router.stack
      .filter(layer => layer.route && layer.route.methods.get)
      .map(layer => layer.route.path);
    expect(routes).toContain('/streak');
  });
});