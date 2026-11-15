export class SingleFlight<Key> {
  private readonly pending = new Map<Key, Promise<unknown>>();

  run<Value>(key: Key, task: () => Promise<Value>): Promise<Value> {
    const existing = this.pending.get(key) as Promise<Value> | undefined;
    if (existing) return existing;
    const promise = task().finally(() => {
      if (this.pending.get(key) === promise) this.pending.delete(key);
    });
    this.pending.set(key, promise);
    return promise;
  }
}
