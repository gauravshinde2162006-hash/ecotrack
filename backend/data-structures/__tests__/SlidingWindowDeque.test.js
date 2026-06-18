const { SlidingWindowDeque } = require('../SlidingWindowDeque');

describe('SlidingWindowDeque', () => {
  let deque;

  beforeEach(() => {
    deque = new SlidingWindowDeque(5, 5.0);
  });

  describe('constructor', () => {
    it('should initialize with empty state', () => {
      expect(deque.currentSize).toBe(0);
      expect(deque.getRollingAverage()).toBe(0);
      expect(deque.getCurrentStreak()).toBe(0);
      expect(deque.getMaxStreak()).toBe(0);
      expect(deque.getMin()).toBe(0);
      expect(deque.getMax()).toBe(0);
    });
  });

  describe('push', () => {
    it('should add entries and update size', () => {
      deque.push('2026-06-01', 3.0);
      expect(deque.currentSize).toBe(1);
      deque.push('2026-06-02', 4.0);
      expect(deque.currentSize).toBe(2);
    });

    it('should evict oldest when window is full', () => {
      for (let i = 1; i <= 5; i++) {
        deque.push(`2026-06-0${i}`, i);
      }
      expect(deque.currentSize).toBe(5);
      deque.push('2026-06-06', 6);
      expect(deque.currentSize).toBe(5);
    });
  });

  describe('getRollingAverage', () => {
    it('should compute correct average', () => {
      deque.push('2026-06-01', 2.0);
      deque.push('2026-06-02', 4.0);
      deque.push('2026-06-03', 6.0);
      expect(deque.getRollingAverage()).toBe(4.0);
    });

    it('should update average after eviction', () => {
      for (let i = 1; i <= 5; i++) {
        deque.push(`2026-06-0${i}`, 10);
      }
      expect(deque.getRollingAverage()).toBe(10);
      deque.push('2026-06-06', 0);
      // Now window has [10, 10, 10, 10, 0] => avg = 8
      expect(deque.getRollingAverage()).toBe(8);
    });
  });

  describe('streak tracking', () => {
    it('should count consecutive days below threshold', () => {
      deque.push('2026-06-01', 3.0); // below 5
      deque.push('2026-06-02', 4.0); // below 5
      deque.push('2026-06-03', 2.0); // below 5
      expect(deque.getCurrentStreak()).toBe(3);
    });

    it('should reset streak when above threshold', () => {
      deque.push('2026-06-01', 3.0);
      deque.push('2026-06-02', 4.0);
      deque.push('2026-06-03', 6.0); // above 5
      expect(deque.getCurrentStreak()).toBe(0);
    });

    it('should track max streak correctly', () => {
      deque.push('2026-06-01', 3.0);
      deque.push('2026-06-02', 4.0);
      deque.push('2026-06-03', 6.0); // breaks streak
      deque.push('2026-06-04', 2.0);
      expect(deque.getMaxStreak()).toBe(2);
      expect(deque.getCurrentStreak()).toBe(1);
    });

    it('should count 5.0 exactly as a streak day', () => {
      deque.push('2026-06-01', 5.0); // exactly threshold
      expect(deque.getCurrentStreak()).toBe(1);
    });
  });

  describe('getMin / getMax', () => {
    it('should track minimum value in window', () => {
      deque.push('2026-06-01', 5.0);
      deque.push('2026-06-02', 2.0);
      deque.push('2026-06-03', 8.0);
      expect(deque.getMin()).toBe(2.0);
    });

    it('should track maximum value in window', () => {
      deque.push('2026-06-01', 5.0);
      deque.push('2026-06-02', 2.0);
      deque.push('2026-06-03', 8.0);
      expect(deque.getMax()).toBe(8.0);
    });
  });

  describe('getWindowSum', () => {
    it('should return the total sum of the window', () => {
      deque.push('2026-06-01', 1.0);
      deque.push('2026-06-02', 2.0);
      deque.push('2026-06-03', 3.0);
      expect(deque.getWindowSum()).toBe(6.0);
    });
  });

  describe('toArray', () => {
    it('should return array of entries with isLowCarbon flag', () => {
      deque.push('2026-06-01', 3.0);
      deque.push('2026-06-02', 8.0);
      const arr = deque.toArray();
      expect(arr).toHaveLength(2);
      expect(arr[0]).toEqual({ date: '2026-06-01', value: 3.0, isLowCarbon: true });
      expect(arr[1]).toEqual({ date: '2026-06-02', value: 8.0, isLowCarbon: false });
    });
  });

  describe('rebuild', () => {
    it('should restore state from an array of entries', () => {
      const data = [
        { date: '2026-06-01', value: 2.0 },
        { date: '2026-06-02', value: 3.0 },
        { date: '2026-06-03', value: 4.0 },
      ];
      deque.rebuild(data);
      expect(deque.currentSize).toBe(3);
      expect(deque.getRollingAverage()).toBe(3.0);
      expect(deque.getCurrentStreak()).toBe(3);
      expect(deque.getMin()).toBe(2.0);
      expect(deque.getMax()).toBe(4.0);
    });

    it('should clear previous state before rebuilding', () => {
      deque.push('2026-05-01', 99.0);
      deque.push('2026-05-02', 99.0);
      deque.rebuild([{ date: '2026-06-01', value: 1.0 }]);
      expect(deque.currentSize).toBe(1);
      expect(deque.getRollingAverage()).toBe(1.0);
    });
  });
});
