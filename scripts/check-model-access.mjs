#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";

const TIMEOUT_MS = 45_000;
const PROMPT = "Reply with exactly: OK";

function listModels() {
  const result = spawnSync("pi", ["--list-models"], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split("\n")
    .slice(1) // header
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [provider, model] = line.split(/\s+/);
      return `${provider}/${model}`;
    });
}

function probe(model) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      "pi",
      [
        "--no-session",
        "--no-context-files",
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-themes",
        "--no-tools",
        "--thinking",
        "off",
        "--model",
        model,
        "--print",
        PROMPT,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        model,
        ok: false,
        status: "timeout",
        ms: Date.now() - started,
      });
    }, TIMEOUT_MS);

    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        model,
        ok: false,
        status: "spawn_error",
        ms: Date.now() - started,
        error: error.message,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        model,
        ok: code === 0,
        status: signal
          ? `signal:${signal}`
          : code === 0
            ? "ok"
            : `exit:${code}`,
        ms: Date.now() - started,
        error: stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 300),
      });
    });
  });
}

const models = listModels();
console.log(`Found ${models.length} models from pi --list-models.`);
console.log(
  "Probing each with a tiny real pi call. This may incur small usage.\n",
);

const results = [];
for (const model of models) {
  process.stdout.write(`${model} ... `);
  const result = await probe(model);
  results.push(result);
  console.log(
    result.ok
      ? `OK (${result.ms}ms)`
      : `FAIL ${result.status} (${result.ms}ms)`,
  );
}

const available = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

console.log("\n## Available");
for (const r of available) console.log(`- ${r.model}`);

console.log("\n## Failed");
for (const r of failed) {
  console.log(`- ${r.model} — ${r.status}${r.error ? ` — ${r.error}` : ""}`);
}

console.log(`\nSummary: ${available.length}/${results.length} available.`);
process.exit(failed.length ? 1 : 0);
