/**
 * MaxHeap — O(log n) insert/update, O(1) peek for top emission category
 *
 * Design: Binary max-heap stored as array. Parent ≥ children invariant.
 * Each node: { category: string, value: number }
 *
 * Time Complexity:
 *   - insert(category, value): O(log n) — sift up
 *   - peekMax():               O(1)     — root element
 *   - extractMax():            O(log n) — remove root, sift down
 *   - updateCategory():        O(n) find + O(log n) sift — acceptable for small n (≤10 categories)
 *   - buildHeap(array):        O(n)     — Floyd's algorithm
 *
 * vs. scanning all categories each time for max: O(n) per query — avoided here.
 */

class MaxHeap {
  constructor() {
    this._heap = []; // 0-indexed array representation
    this._indexMap = new Map(); // category → heap index for O(1) position lookup
  }

  /**
   * O(n) — Build heap from array of { category, value } objects using Floyd's algorithm.
   */
  build(items) {
    this._heap = items.map(({ category, value }) => ({ category, value }));
    this._indexMap.clear();
    this._heap.forEach((node, i) => this._indexMap.set(node.category, i));

    // Heapify from last non-leaf — O(n) total
    for (let i = Math.floor(this._heap.length / 2) - 1; i >= 0; i--) {
      this._siftDown(i);
    }
  }

  /**
   * O(log n) — Insert a new category-value pair.
   */
  insert(category, value) {
    if (this._indexMap.has(category)) {
      this.updateCategory(category, value);
      return;
    }
    const node = { category, value };
    this._heap.push(node);
    const i = this._heap.length - 1;
    this._indexMap.set(category, i);
    this._siftUp(i);
  }

  /**
   * O(1) — Return the category with the highest emission value.
   * @returns {{ category: string, value: number } | null}
   */
  peekMax() {
    return this._heap.length > 0 ? { ...this._heap[0] } : null;
  }

  /**
   * O(log n) — Remove and return the top emission category.
   */
  extractMax() {
    if (this._heap.length === 0) return null;
    const max = { ...this._heap[0] };
    this._indexMap.delete(max.category);
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._indexMap.set(last.category, 0);
      this._siftDown(0);
    }
    return max;
  }

  /**
   * O(log n) — Update the emission value for an existing category.
   * If category doesn't exist, inserts it.
   */
  updateCategory(category, newValue) {
    if (!this._indexMap.has(category)) {
      this.insert(category, newValue);
      return;
    }
    const i = this._indexMap.get(category);
    const oldValue = this._heap[i].value;
    this._heap[i].value = newValue;
    if (newValue > oldValue) {
      this._siftUp(i);
    } else {
      this._siftDown(i);
    }
  }

  /**
   * O(n) — Return all items sorted by emission value descending.
   * Creates a copy of the heap to avoid mutation.
   */
  getSorted() {
    const copy = new MaxHeap();
    copy.build(this._heap.map(n => ({ ...n })));
    const result = [];
    while (copy._heap.length > 0) result.push(copy.extractMax());
    return result;
  }

  get size() { return this._heap.length; }

  // ── Private helpers ───────────────────────────────────────────────────────

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i)   { return 2 * i + 1; }
  _right(i)  { return 2 * i + 2; }

  _swap(i, j) {
    [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    this._indexMap.set(this._heap[i].category, i);
    this._indexMap.set(this._heap[j].category, j);
  }

  _siftUp(i) {
    while (i > 0 && this._heap[i].value > this._heap[this._parent(i)].value) {
      const p = this._parent(i);
      this._swap(i, p);
      i = p;
    }
  }

  _siftDown(i) {
    const n = this._heap.length;
    let largest = i;
    const l = this._left(i), r = this._right(i);
    if (l < n && this._heap[l].value > this._heap[largest].value) largest = l;
    if (r < n && this._heap[r].value > this._heap[largest].value) largest = r;
    if (largest !== i) {
      this._swap(i, largest);
      this._siftDown(largest);
    }
  }
}

module.exports = { MaxHeap };
