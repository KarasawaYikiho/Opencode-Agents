export class RetryGuard {
  private counts: Map<string, number> = new Map();
  private maxRetries: number;

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  canDispatch(key: string): boolean {
    const count = this.counts.get(key) ?? 0;
    return count < this.maxRetries;
  }

  recordDispatch(key: string): void {
    const count = this.counts.get(key) ?? 0;
    this.counts.set(key, count + 1);
  }

  isExceeded(key: string): boolean {
    return !this.canDispatch(key);
  }

  getCount(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  reset(key: string): void {
    this.counts.delete(key);
  }

  resetAll(): void {
    this.counts.clear();
  }
}
