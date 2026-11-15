import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { engineeringStatusSchema } from "@simon/contracts";

import { ConventionAdmin, type ConventionAdminCommand } from "./convention-admin.js";
import { ConventionService } from "./convention-service.js";
import { ConventionStore } from "./convention-store.js";
import { EngineeringSnapshotConventionExampleSource } from "./engineering-convention-examples.js";

const valueFlags = new Set(["convention-id", "conversation-id", "actor", "note", "title", "rule", "rationale", "scope", "exception"]);

function parseFlags(args: readonly string[]): Map<string, string[]> {
  const flags = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (name === "confirm") {
      if (flags.has(name)) throw new Error("Duplicate --confirm flag.");
      flags.set(name, ["true"]);
      continue;
    }
    if (!valueFlags.has(name)) throw new Error(`Unknown option: --${name}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option --${name} requires a value.`);
    flags.set(name, [...(flags.get(name) ?? []), value]);
    index += 1;
  }
  return flags;
}

function one(flags: Map<string, string[]>, name: string, required = false): string | undefined {
  const values = flags.get(name) ?? [];
  if (values.length > 1 && name !== "scope" && name !== "exception") throw new Error(`Option --${name} may be supplied only once.`);
  const value = values[0];
  if (required && !value) throw new Error(`Option --${name} is required.`);
  return value;
}

export function parseConventionAdminArgs(argv: readonly string[]): ConventionAdminCommand {
  const [command, ...rest] = argv;
  if (!command || !["status", "history", "infer", "approve", "reject", "revise", "retire"].includes(command)) {
    throw new Error("Command must be one of: status, history, infer, approve, reject, revise, retire.");
  }
  const flags = parseFlags(rest);
  if (command === "status") {
    if (flags.size > 0) throw new Error("The status command accepts no options.");
    return { command: "status" };
  }
  if (command === "infer") {
    const conversationId = one(flags, "conversation-id", true)!;
    if (!flags.has("confirm")) throw new Error("The infer command requires --confirm to authorize current snapshot examples.");
    if ([...flags.keys()].some((name) => !["conversation-id", "confirm"].includes(name))) throw new Error("The infer command accepts only --conversation-id and --confirm.");
    return { command: "infer", conversationId, confirmed: true };
  }
  const conventionId = one(flags, "convention-id", true)!;
  if (command === "history") {
    if ([...flags.keys()].some((name) => name !== "convention-id")) throw new Error("The history command accepts only --convention-id.");
    return { command: "history", conventionId };
  }
  const actor = one(flags, "actor", true)!;
  const note = one(flags, "note", true)!;
  if (!flags.has("confirm")) throw new Error("Mutation commands require --confirm.");
  if (command === "approve" || command === "reject") return { command, conventionId, actor, note, confirmed: true };
  if (command === "retire") return { command, conventionId, actor, note, confirmed: true };
  return {
    command: "revise", conventionId, actor, note, confirmed: true,
    ...(one(flags, "title") ? { title: one(flags, "title") } : {}),
    ...(one(flags, "rule") ? { rule: one(flags, "rule") } : {}),
    ...(one(flags, "rationale") ? { rationale: one(flags, "rationale") } : {}),
    ...(flags.has("scope") ? { scope: flags.get("scope") } : {}),
    ...(flags.has("exception") ? { exceptions: flags.get("exception") } : {}),
  } as ConventionAdminCommand;
}

export async function runConventionAdminCli(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<unknown> {
  const projectRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  const dataDirectory = resolve(env.SIMON_DATA_DIR ?? resolve(projectRoot, "data"));
  const store = new ConventionStore(resolve(dataDirectory, "conventions.sqlite"));
  const port = Number.parseInt(env.SIMON_PORT ?? "4310", 10);
  const examples = new EngineeringSnapshotConventionExampleSource(resolve(dataDirectory, "simon.sqlite"), async (conversationId) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/engineering/status?conversationId=${encodeURIComponent(conversationId)}`);
    if (!response.ok) throw new Error("Simon must be running on loopback with a current engineering binding.");
    return engineeringStatusSchema.parse(await response.json());
  });
  try {
    return await new ConventionAdmin(new ConventionService(store), examples).execute(parseConventionAdminArgs(argv));
  } finally {
    store.close();
  }
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  runConventionAdminCli(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Convention administration failed."}\n`);
    process.exitCode = 1;
  });
}
