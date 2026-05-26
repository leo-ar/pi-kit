import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePhpOutline } from "../src/languages/php.ts";

describe("generatePhpOutline (tree-sitter) — edge cases that regex got wrong", () => {
  it("handles heredoc containing braces", async () => {
    const lines = [
      "<?php",
      "",
      "class Template {",
      "    public function render(): string {",
      "        return <<<HTML",
      '        <div class="test">{$this->name}</div>',
      "        <script>if (x) { doStuff(); }</script>",
      "        HTML;",
      "    }",
      "",
      "    public function other(): void {",
      '        echo "hello";',
      "    }",
      "}",
    ];
    const result = await generatePhpOutline(lines);
    const render = result.find(e => e.name === "render");
    const other = result.find(e => e.name === "other");

    assert.ok(render, "should find render method");
    assert.ok(other, "should find other method");
    assert.strictEqual(render!.startLine, 4);
    assert.strictEqual(render!.endLine, 9);
    assert.strictEqual(other!.startLine, 11);
    assert.strictEqual(other!.endLine, 13);
  });

  it("handles anonymous class inside method", async () => {
    const lines = [
      "<?php",
      "",
      "class Factory {",
      "    public function create(): object {",
      "        return new class($this->dep) {",
      "            public function run(): void {",
      '                echo "running";',
      "            }",
      "        };",
      "    }",
      "",
      "    public function destroy(): void {",
      '        echo "destroyed";',
      "    }",
      "}",
    ];
    const result = await generatePhpOutline(lines);
    const factory = result.find(e => e.name === "Factory");
    const create = result.find(e => e.name === "create");
    const destroy = result.find(e => e.name === "destroy");

    assert.ok(factory, "should find Factory class");
    assert.ok(create, "should find create method");
    assert.ok(destroy, "should find destroy method");
    // Key: destroy should NOT be swallowed by create's block
    assert.strictEqual(create!.endLine, 10);
    assert.strictEqual(destroy!.startLine, 12);
    assert.strictEqual(destroy!.endLine, 14);
  });

  it("handles closure with use()", async () => {
    const lines = [
      "<?php",
      "",
      "class Handler {",
      "    public function process(): Closure {",
      "        $self = $this;",
      "        return function (Request $r) use ($self) {",
      "            return $self->handle($r);",
      "        };",
      "    }",
      "",
      "    public function handle(Request $r): Response {",
      "        return new Response();",
      "    }",
      "}",
    ];
    const result = await generatePhpOutline(lines);
    const process = result.find(e => e.name === "process");
    const handle = result.find(e => e.name === "handle");

    assert.ok(process, "should find process method");
    assert.ok(handle, "should find handle method");
    assert.strictEqual(process!.endLine, 9);
    assert.strictEqual(handle!.startLine, 11);
  });

  it("handles multi-line method signature with array default", async () => {
    const lines = [
      "<?php",
      "",
      "class Service {",
      "    public function create(",
      "        string $name,",
      "        array $options = ['key' => 'value']",
      "    ): Model {",
      "        return new Model($name);",
      "    }",
      "",
      "    public function delete(int $id): void {",
      "        Model::destroy($id);",
      "    }",
      "}",
    ];
    const result = await generatePhpOutline(lines);
    const create = result.find(e => e.name === "create");
    const del = result.find(e => e.name === "delete");

    assert.ok(create, "should find create");
    assert.ok(del, "should find delete");
    // Tree-sitter correctly spans multi-line signature
    assert.strictEqual(create!.startLine, 4);
    assert.strictEqual(create!.endLine, 9);
    assert.strictEqual(del!.startLine, 11);
  });

  it("handles nested array with closures (arrow functions)", async () => {
    const lines = [
      "<?php",
      "",
      "class Router {",
      "    public function routes(): array {",
      "        return [",
      "            'get' => fn(Request $r) => $this->index($r),",
      "            'post' => fn(Request $r) => $this->store($r),",
      "        ];",
      "    }",
      "",
      "    public function index(Request $r): Response {",
      "        return new Response();",
      "    }",
      "}",
    ];
    const result = await generatePhpOutline(lines);
    const routes = result.find(e => e.name === "routes");
    const index = result.find(e => e.name === "index");

    assert.ok(routes, "should find routes");
    assert.ok(index, "should find index");
    assert.strictEqual(routes!.endLine, 9);
    assert.strictEqual(index!.startLine, 11);
  });
});
