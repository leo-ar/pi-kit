import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePhpOutline } from "../src/languages/php.ts";

describe("generatePhpOutline — examples", () => {
  it("detects a top-level function", () => {
    const lines = [
      "<?php",
      "",
      "function hello(string $name): void {",
      '    echo "Hello, $name!";',
      "}",
    ];
    const result = generatePhpOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].kind, "fn");
    assert.equal(result[0].name, "hello");
    assert.equal(result[0].startLine, 3);
    assert.equal(result[0].endLine, 5);
    assert.equal(result[0].exported, true);
  });

  it("detects class with methods", () => {
    const lines = [
      "<?php",
      "",
      "class UserController {",
      "    public function index(): Response {",
      '        return view("users.index");',
      "    }",
      "",
      "    private function validate(Request $request): array {",
      '        return $request->validate(["name" => "required"]);',
      "    }",
      "}",
    ];
    const result = generatePhpOutline(lines);
    // class + 2 methods
    assert.ok(result.length >= 1);
    const cls = result.find(e => e.kind === "class");
    assert.ok(cls);
    assert.equal(cls!.name, "UserController");
    assert.equal(cls!.startLine, 3);
    assert.equal(cls!.endLine, 11);

    const methods = result.filter(e => e.kind === "fn");
    assert.equal(methods.length, 2);
    assert.equal(methods[0].name, "index");
    assert.equal(methods[0].exported, true);
    assert.equal(methods[1].name, "validate");
    assert.equal(methods[1].exported, false);
  });

  it("detects interface", () => {
    const lines = [
      "<?php",
      "",
      "interface Renderable {",
      "    public function render(): string;",
      "}",
    ];
    const result = generatePhpOutline(lines);
    const iface = result.find(e => e.kind === "interface");
    assert.ok(iface);
    assert.equal(iface!.name, "Renderable");
  });

  it("detects trait", () => {
    const lines = [
      "<?php",
      "",
      "trait HasTimestamps {",
      "    public function getCreatedAt(): DateTime {",
      '        return $this->createdAt;',
      "    }",
      "}",
    ];
    const result = generatePhpOutline(lines);
    const trait = result.find(e => e.kind === "trait");
    assert.ok(trait);
    assert.equal(trait!.name, "HasTimestamps");
  });

  it("detects namespace", () => {
    const lines = [
      "<?php",
      "",
      "namespace App\\Http\\Controllers;",
      "",
      "class HomeController {",
      "}",
    ];
    const result = generatePhpOutline(lines);
    const ns = result.find(e => e.kind === "namespace");
    assert.ok(ns);
    assert.equal(ns!.name, "App\\Http\\Controllers");
  });

  it("detects enum (PHP 8.1)", () => {
    const lines = [
      "<?php",
      "",
      "enum Status {",
      "    case Active;",
      "    case Inactive;",
      "}",
    ];
    const result = generatePhpOutline(lines);
    const en = result.find(e => e.kind === "enum");
    assert.ok(en);
    assert.equal(en!.name, "Status");
  });

  it("detects define() constants", () => {
    const lines = [
      "<?php",
      "",
      "define('APP_VERSION', '1.0.0');",
      "define('MAX_RETRIES', 3);",
    ];
    const result = generatePhpOutline(lines);
    assert.equal(result.length, 2);
    assert.equal(result[0].kind, "const");
    assert.equal(result[0].name, "APP_VERSION");
    assert.equal(result[1].name, "MAX_RETRIES");
  });

  it("detects abstract class", () => {
    const lines = [
      "<?php",
      "",
      "abstract class BaseModel {",
      "    abstract protected function tableName(): string;",
      "}",
    ];
    const result = generatePhpOutline(lines);
    const cls = result.find(e => e.kind === "class");
    assert.ok(cls);
    assert.equal(cls!.name, "BaseModel");
  });

  it("detects final class", () => {
    const lines = [
      "<?php",
      "",
      "final class Config {",
      "    public const DB_HOST = 'localhost';",
      "}",
    ];
    const result = generatePhpOutline(lines);
    const cls = result.find(e => e.kind === "class");
    assert.ok(cls);
    assert.equal(cls!.name, "Config");

    const consts = result.filter(e => e.kind === "const");
    assert.equal(consts.length, 1);
    assert.equal(consts[0].name, "DB_HOST");
  });
});
