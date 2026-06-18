describe('seed module', () => {
  const { seed } = require('./seed');

  it('should export seed function', () => {
    expect(typeof seed).toBe('function');
  });

  it('seed function should return a promise', () => {
    // Just verify it's async - don't actually run it
    const result = seed.constructor.name;
    expect(result).toBe('AsyncFunction');
  });
});