describe('db module', () => {
  const { getDb, initSchema, closeDb } = require('./db');

  it('should export getDb function', () => {
    expect(typeof getDb).toBe('function');
  });

  it('should export initSchema function', () => {
    expect(typeof initSchema).toBe('function');
  });

  it('should export closeDb function', () => {
    expect(typeof closeDb).toBe('function');
  });

  it('should return a Knex instance from getDb', () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(typeof db).toBe('function');
    // Knex instances have .raw, .schema, .select etc.
    expect(typeof db.raw).toBe('function');
    expect(typeof db.schema).toBe('object');
  });

  it('should return the same instance on repeated calls (singleton)', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});