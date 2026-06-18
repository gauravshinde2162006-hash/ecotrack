const { getOrSet, invalidate, get, set, getClient } = require('./redisService');

describe('redisService', () => {
  describe('module exports', () => {
    it('should export getOrSet function', () => {
      expect(typeof getOrSet).toBe('function');
    });

    it('should export invalidate function', () => {
      expect(typeof invalidate).toBe('function');
    });

    it('should export get function', () => {
      expect(typeof get).toBe('function');
    });

    it('should export set function', () => {
      expect(typeof set).toBe('function');
    });

    it('should export getClient function', () => {
      expect(typeof getClient).toBe('function');
    });
  });

  describe('getOrSet (fallback mode without Redis)', () => {
    it('should execute factory function when cache is unavailable', async () => {
      const factory = jest.fn().mockResolvedValue({ score: 100 });
      const result = await getOrSet('test:fallback', factory, 60);
      expect(result).toEqual({ score: 100 });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should handle string return values', async () => {
      const result = await getOrSet('test:string', async () => 'hello', 60);
      expect(result).toBe('hello');
    });

    it('should handle numeric return values', async () => {
      const result = await getOrSet('test:number', async () => 42, 60);
      expect(result).toBe(42);
    });

    it('should handle array return values', async () => {
      const result = await getOrSet('test:array', async () => [1, 2, 3], 60);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('get (fallback mode without Redis)', () => {
    it('should return null when Redis is not connected', async () => {
      const result = await get('nonexistent:key');
      expect(result).toBeNull();
    });
  });

  describe('invalidate (fallback mode without Redis)', () => {
    it('should not throw when Redis is not connected', async () => {
      await expect(invalidate('some:key')).resolves.not.toThrow();
    });
  });

  describe('set (fallback mode without Redis)', () => {
    it('should not throw when Redis is not connected', async () => {
      await expect(set('some:key', { data: 1 }, 60)).resolves.not.toThrow();
    });
  });
});