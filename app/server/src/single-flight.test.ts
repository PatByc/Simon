import { describe, expect, it, vi } from "vitest";

import { SingleFlight } from "./single-flight.js";

describe("SingleFlight", () => {
  it("shares one in-flight initialization for concurrent callers and permits later retries", async () => {
    const flights = new SingleFlight<string>();
    let release!: (value: { id: number }) => void;
    const task = vi.fn(() => new Promise<{ id: number }>((resolve) => { release = resolve; }));
    const first = flights.run("conversation", task);
    const second = flights.run("conversation", task);
    expect(task).toHaveBeenCalledTimes(1);
    release({ id: 1 });
    await expect(Promise.all([first, second])).resolves.toEqual([{ id: 1 }, { id: 1 }]);
    await expect(flights.run("conversation", async () => ({ id: 2 }))).resolves.toEqual({ id: 2 });
  });

  it("clears rejected work so initialization can recover", async () => {
    const flights = new SingleFlight<string>();
    await expect(flights.run("conversation", async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    await expect(flights.run("conversation", async () => "recovered")).resolves.toBe("recovered");
  });
});
