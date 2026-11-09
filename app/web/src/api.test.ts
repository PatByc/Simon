import { afterEach, describe, expect, it, vi } from "vitest";
import { watchRun } from "./api.js";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  readonly url: string;
  readyState = 1;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback = listener as (event: MessageEvent<string>) => void;
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }

  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }
}

const runId = "c3fef7e4-790d-4afc-9591-e11df4eb362d";
const conversationId = "8afc901e-777c-4f9f-bfac-1727efb1f66d";

function event(sequence: number, eventType: "run.started" | "run.completed") {
  return {
    schemaVersion: 1,
    runId,
    conversationId,
    sequence,
    occurredAt: "2026-11-07T14:30:00.000Z",
    eventType,
    payload: eventType === "run.started" ? { status: "running" } : { status: "completed" },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeEventSource.instances = [];
});

describe("watchRun", () => {
  it("reconnects from the last sequence and ignores replay duplicates", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", FakeEventSource);
    const received: number[] = [];
    const errors: Error[] = [];
    const states: string[] = [];

    watchRun(runId, (item) => received.push(item.sequence), (error) => errors.push(error), (state) => states.push(state.status));
    const first = FakeEventSource.instances[0];
    expect(first?.url).toContain("after=0");
    first?.emit("run.started", event(1, "run.started"));
    first?.onerror?.();

    await vi.advanceTimersByTimeAsync(500);
    const second = FakeEventSource.instances[1];
    expect(second?.url).toContain("after=1");
    second?.onopen?.();
    second?.emit("run.started", event(1, "run.started"));
    second?.emit("run.completed", event(2, "run.completed"));

    expect(received).toEqual([1, 2]);
    expect(errors).toEqual([]);
    expect(states).toEqual(["reconnecting", "recovered"]);
  });

  it("reports exhausted reconnect attempts", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", FakeEventSource);
    const states: string[] = [];
    const errors: Error[] = [];
    watchRun(runId, () => {}, (error) => errors.push(error), (state) => states.push(state.status));

    for (const delay of [500, 1000, 2000, 2000, 2000]) {
      FakeEventSource.instances.at(-1)?.onerror?.();
      await vi.advanceTimersByTimeAsync(delay);
    }
    FakeEventSource.instances.at(-1)?.onerror?.();

    expect(states.at(-1)).toBe("exhausted");
    expect(errors[0]?.message).toContain("repeated reconnect attempts");
  });
});
