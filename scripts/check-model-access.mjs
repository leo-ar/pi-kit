#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const args = new Set(process.argv.slice(2));
const argValue = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const live = args.has("--live");
const timeoutMs = Number(argValue("--timeout-ms", "45000"));
const prompt = argValue("--prompt", "Reply with exactly: OK");
const settingsPath = argValue(
  "--settings",
  join(homedir(), ".pi", "agent", "settings.json"),
);
const onlyModels = argValue("--models", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function usage() {
  console.log(`Usage: node scripts/check-model-access.mjs [--live] [options]

Checks which pi enabledModels are actually callable in this environment.

Default mode is dry-run: list configured exact models without making LLM calls.
Use --live to perform a tiny pi print-mode request for each model.

Options:
  --live                 Actually call each model via pi -p
  --models=a,b,c         Comma-separated model ids/patterns to test instead of settings enabledModels
  --settings=path        Settings file to read (default: ~/.pi/agent/settings.json)
  --timeout-ms=45000     Per-model timeout
  --prompt='...'         Probe prompt (default: 'Reply with exactly: OK')

Notes:
  - This uses the real pi CLI/auth path, so it catches provider/IT access failures.
  - Globs/fuzzy patterns are reported but skipped; pass exact provider/model ids for live tests.
  - Live mode may incur small provider/Copilot usage.
`);
}

if (args.has("--help") || args.has("-h")) {
  usage();
  process.exit(0);
}

function loadModels() {
  if (onlyModels.length) return onlyModels;
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  return Array.isArray(settings.enabledModels) ? settings.enabledModels : [];
}

function isExactModel(model) {
  return model.includes("/") && !/[*!?\[\]{}]/.test(model);
}

function runProbe(model) {
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
        prompt,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        model,
        ok: false,
        status: "timeout",
        ms: Date.now() - started,
      });
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
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
      if (signal) {
        resolve({
          model,
          ok: false,
          status: `signal:${signal}`,
          ms: Date.now() - started,
        });
        return;
      }
      const output = stdout.trim();
      const err = stderr.trim();
      resolve({
        model,
        ok: code === 0,
        status: code === 0 ? "ok" : `exit:${code}`,
        ms: Date.now() - started,
        output: output.slice(0, 120).replace(/\s+/g, " "),
        error: err.split("\n").slice(-3).join(" | ").slice(0, 240),
      });
    });
  });
}

const models = [...new Set(loadModels())];
const exact = models.filter(isExactModel);
const skipped = models.filter((m) => !isExactModel(m));

console.log(`Settings: ${settingsPath}`);
console.log(`Configured models: ${models.length}`);
console.log(`Exact models: ${exact.length}`);
if (skipped.length) {
  console.log(`Skipped non-exact patterns: ${skipped.join(", ")}`);
}

if (!live) {
  console.log("\nDry run only. Add --live to actually test access.\n");
  for (const model of exact) console.log(`- ${model}`);
  process.exit(0);
}

console.log("\nLive probing models with tiny pi print-mode calls...\n");
const results = [];
for (const model of exact) {
  process.stdout.write(`${model} ... `);
  const result = await runProbe(model);
  results.push(result);
  console.log(
    result.ok
      ? `OK (${result.ms}ms)`
      : `FAIL ${result.status} (${result.ms}ms)`,
  );
}

const ok = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

console.log("\n## Summary");
console.log(`Available: ${ok.length}/${results.length}`);
console.log(`Unavailable: ${failed.length}/${results.length}`);

console.log("\n## Available");
for (const r of ok) console.log(`- ${r.model} (${r.ms}ms)`);

if (failed.length) {
  console.log("\n## Failed");
  for (const r of failed) {
    console.log(`- ${r.model} — ${r.status}${r.error ? ` — ${r.error}` : ""}`);
  }
}

process.exit(failed.length ? 1 : 0);
