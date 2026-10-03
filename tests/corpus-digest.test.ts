import { assertEquals } from "@std/assert"
import { corpusUrl } from "./support/corpus.ts"

const DIGEST_FILE = "corpus.sha256"

const hex = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")

const filesUnder = (directory: string): ReadonlyArray<string> =>
  [...Deno.readDirSync(corpusUrl(directory))].flatMap((entry) =>
    entry.isDirectory ? filesUnder(`${directory}${entry.name}/`) : [`${directory}${entry.name}`]
  )

const corpusDigest = async (): Promise<string> => {
  const files = filesUnder("").filter((path) => path !== DIGEST_FILE).sort()
  const lines = await Promise.all(
    files.map(async (path) => `${path}\n${await hex(Deno.readFileSync(corpusUrl(path)))}\n`),
  )
  return hex(new TextEncoder().encode(lines.join("")))
}

Deno.test("corpus: every file matches the pinned digest shared with the PHP port", async () => {
  assertEquals(await corpusDigest(), Deno.readTextFileSync(corpusUrl(DIGEST_FILE)).trim())
})
