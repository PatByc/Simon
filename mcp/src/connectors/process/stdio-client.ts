import type { ChildProcessWithoutNullStreams } from "node:child_process";

export class JsonLineClient {
  readonly #process: ChildProcessWithoutNullStreams;

  constructor(process: ChildProcessWithoutNullStreams) {
    this.#process = process;
  }

  write(message: unknown): void {
    this.#process.stdin.write(`${JSON.stringify(message)}\n`);
  }
}
