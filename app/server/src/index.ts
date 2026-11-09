import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app.js";
import { FakeAssistant } from "./fake-assistant.js";
import { PiAssistant } from "./pi-assistant.js";
import { InMemoryStore } from "./store.js";
import { UsageService } from "./usage-service.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const host = process.env.SIMON_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.SIMON_PORT ?? "4310", 10);
const runtimeName = process.env.SIMON_RUNTIME ?? "pi";
const dataDirectory = resolve(process.env.SIMON_DATA_DIR ?? resolve(projectRoot, "data"));
const store = new InMemoryStore(resolve(dataDirectory, "simon.sqlite"));
const assistant = runtimeName === "fake"
  ? new FakeAssistant(store)
  : new PiAssistant(store, projectRoot, resolve(dataDirectory, "pi-sessions"));
const app = buildApp({
  logger: true,
  store,
  assistant,
  usageService: new UsageService(resolve(process.env.USERPROFILE ?? "", ".pi/agent/auth.json")),
});
const webRoot = resolve(projectRoot, "app/web/dist");

if (existsSync(webRoot)) {
  await app.register(fastifyStatic, { root: webRoot, prefix: "/" });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({
      code: "not_found",
      message: "Route not found",
      correlationId: request.id,
    });
  });
}

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
