import { assertEquals } from "@std/assert"

const SOURCE_DIR = new URL("../src/", import.meta.url)

const sources = [...Deno.readDirSync(SOURCE_DIR)]
  .filter((entry) => entry.isFile && entry.name.endsWith(".ts"))
  .map((entry) => ({ name: entry.name, text: Deno.readTextFileSync(new URL(entry.name, SOURCE_DIR)) }))

Deno.test("fence ADR-0003: source files import only sibling modules, so the package has no runtime dependency", () => {
  const specifiers = sources.flatMap(({ text }) => [...text.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]))
  assertEquals(specifiers.filter((specifier) => !specifier?.startsWith("./")), [])
})

Deno.test("fence ADR-0005: the RelayUrl brand is the only type assertion in the source", () => {
  const assertions = sources.flatMap(({ name, text }) =>
    [...text.matchAll(/\bas\s+(?!const\b)[A-Z]\w*/g)].map((match) => `${name}: ${match[0]}`)
  )
  assertEquals(assertions, ["normalise-url.ts: as RelayUrl"])
})
