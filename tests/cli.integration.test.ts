import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { existsSync } from "node:fs"

const execFileAsync = promisify(execFile)
const CLI = join(process.cwd(), "dist", "cli.cjs")

function memshot(args: string[], memshotDir: string) {
  return execFileAsync(process.execPath, [CLI, ...args], {
    env: { ...process.env, MEMSHOT_DIR: memshotDir }
  })
}

describe.skipIf(!existsSync(CLI))("cli integration", () => {
  let dir: string
  let memshotDir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "memshot-cli-test-"))
    memshotDir = join(dir, ".memshot")
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("add then list", async () => {
    const { stdout: addOut } = await memshot(["add", "hello world", "--tier", "hot"], memshotDir)
    expect(addOut).toContain("added")

    const { stdout: listOut } = await memshot(["list"], memshotDir)
    expect(listOut).toContain("hello world")
    expect(listOut).toContain("hot")
  })

  it("resolve returns selected items", async () => {
    await memshot(["add", "billing rules: ship Stripe first", "--tier", "warm", "--trigger", "/billing/i"], memshotDir)
    await memshot(["add", "user name is Ayberk", "--tier", "hot"], memshotDir)

    const { stdout } = await memshot(["resolve", "what are the billing rules?", "--budget", "1000"], memshotDir)
    expect(stdout).toContain("tokens used:")
    expect(stdout).toContain("tiers:")
  })

  it("resolve --trace shows score table", async () => {
    await memshot(["add", "project uses TypeScript strict mode", "--tier", "cold"], memshotDir)

    const { stdout } = await memshot(["resolve", "TypeScript config", "--trace"], memshotDir)
    expect(stdout).toMatch(/composite|TIER/)
  })

  it("stats shows tier breakdown", async () => {
    await memshot(["add", "item one", "--tier", "hot"], memshotDir)
    await memshot(["add", "item two", "--tier", "cold"], memshotDir)

    const { stdout } = await memshot(["stats"], memshotDir)
    expect(stdout).toContain("total:")
    expect(stdout).toContain("hot")
    expect(stdout).toContain("cold")
  })

  it("delete removes item", async () => {
    const { stdout: addOut } = await memshot(["add", "to be deleted", "--tier", "warm"], memshotDir)
    const id = addOut.match(/\d{10,}-[a-z0-9]+/)?.[0]
    expect(id).toBeDefined()

    await memshot(["delete", id!], memshotDir)
    const { stdout: listOut } = await memshot(["list"], memshotDir)
    expect(listOut).not.toContain("to be deleted")
  })

  it("clear empties store", async () => {
    await memshot(["add", "item A", "--tier", "hot"], memshotDir)
    await memshot(["add", "item B", "--tier", "cold"], memshotDir)
    await memshot(["clear"], memshotDir)

    const { stdout } = await memshot(["list"], memshotDir)
    expect(stdout).toContain("no memories")
  })

  it("unknown command exits non-zero", async () => {
    await expect(memshot(["bogus"], memshotDir)).rejects.toThrow()
  })
})
