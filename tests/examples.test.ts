import { assertEquals } from "@std/assert"

const examples = [...Deno.readDirSync(new URL("../examples/", import.meta.url))]
  .filter((entry) => entry.isFile && entry.name.endsWith(".ts"))
  .map((entry) => entry.name)

for (const example of examples) {
  Deno.test(`examples: ${example} runs with no permissions`, async () => {
    const path = new URL(`../examples/${example}`, import.meta.url).pathname
    const { code } = await new Deno.Command(Deno.execPath(), { args: ["run", "--no-prompt", path], stdout: "null" })
      .output()
    assertEquals(code, 0)
  })
}
