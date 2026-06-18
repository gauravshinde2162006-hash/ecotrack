describe('social route module', () => {
  it('should export an Express router', () => {
    const router = require('./social');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});