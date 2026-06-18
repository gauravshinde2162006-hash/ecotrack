describe('webhooks route module', () => {
  it('should export an Express router', () => {
    const router = require('./webhooks');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});