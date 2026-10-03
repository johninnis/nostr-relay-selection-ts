import { assertEquals } from "@std/assert"
import { createRelayDirectory, type RelayRole } from "../mod.ts"
import { corpusUrl, eventsOf, loadJson, objectOf, pubkeyOf, stringOf } from "./support/corpus.ts"

const ROLES: ReadonlyArray<RelayRole> = ["inbox", "outbox", "dm"]

const fixtureFiles = [...Deno.readDirSync(corpusUrl("real-world/"))]
  .filter((entry) => entry.isFile && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort()

for (const file of fixtureFiles) {
  const fixture = objectOf(loadJson(`real-world/${file}`))
  const directory = createRelayDirectory(eventsOf(fixture.events))
  const expected = objectOf(fixture.expected)
  for (const role of ROLES) {
    Deno.test(`real-world: ${stringOf(fixture.name)} — ${role}`, () => {
      assertEquals([...directory.relaysOf(pubkeyOf(fixture.pubkey), role)], expected[role])
    })
  }
}
