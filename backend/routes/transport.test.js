describe('transport route module', () => {
  it('should export an Express router', () => {
    const router = require('./transport');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});