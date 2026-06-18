describe('insights route module', () => {
  it('should export an Express router', () => {
    const router = require('./insights');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});

describe('webhooks route module', () => {
  it('should export an Express router', () => {
    const router = require('./webhooks');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});