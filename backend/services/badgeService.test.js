const { BADGES } = require('./badgeService');

describe('badgeService', () => {
  describe('BADGES constants', () => {
    it('should export FIRST_LOG badge with correct shape', () => {
      expect(BADGES.FIRST_LOG).toEqual({
        id: 'first_log',
        name: 'First Log',
        icon: '🌱',
      });
    });

    it('should export STREAK_7 badge', () => {
      expect(BADGES.STREAK_7).toEqual({
        id: 'streak_7',
        name: '1-Week Streak',
        icon: '🔥',
      });
    });

    it('should export ECO_COMMUTER badge', () => {
      expect(BADGES.ECO_COMMUTER).toEqual({
        id: 'eco_commuter',
        name: 'Eco Commuter',
        icon: '🚲',
      });
    });

    it('should have unique IDs for all badges', () => {
      const ids = Object.values(BADGES).map(b => b.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should have non-empty icons for all badges', () => {
      Object.values(BADGES).forEach(badge => {
        expect(badge.icon).toBeDefined();
        expect(badge.icon.length).toBeGreaterThan(0);
      });
    });
  });
});