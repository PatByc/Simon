export class EventRecorder<T> {
  readonly events: T[] = [];
  record(event: T): void {
    this.events.push(event);
  }
}
