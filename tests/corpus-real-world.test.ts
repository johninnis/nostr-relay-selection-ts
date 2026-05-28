import { assertEquals } from "@std/assert"
import {
  type Event,
  type PublicKey,
  selectAuthorDmRelays,
  selectAuthorInboxRelays,
  selectAuthorOutboxRelays,
} from "../mod.ts"

interface RealWorldFixture {
  readonly name: string
  readonly pubkey: PublicKey
  readonly events: ReadonlyArray<Event>
  readonly expected: {
    readonly inbox: ReadonlyArray<string>
    readonly outbox: ReadonlyArray<string>
    readonly dm: ReadonlyArray<string>
  }
}

const loadFixtures = (): ReadonlyArray<RealWorldFixture> => {
  const dir = new URL("./corpus/real-world/", import.meta.url)
  const fixtures: Array<RealWorldFixture> = []
  for (const entry of Deno.readDirSync(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue
    const text = Deno.readTextFileSync(new URL(entry.name, dir))
    // deno-lint-ignore innis/no-type-assertions
    fixtures.push(JSON.parse(text) as RealWorldFixture)
  }
  fixtures.sort((a, b) => a.name.localeCompare(b.name))
  return fixtures
}

for (const fixture of loadFixtures()) {
  const context = { authorPubkey: fixture.pubkey, relayListEvents: fixture.events }

  Deno.test(`real-world: ${fixture.name} — inbox`, () => {
    assertEquals([...selectAuthorInboxRelays(context)], [...fixture.expected.inbox])
  })

  Deno.test(`real-world: ${fixture.name} — outbox`, () => {
    assertEquals([...selectAuthorOutboxRelays(context)], [...fixture.expected.outbox])
  })

  Deno.test(`real-world: ${fixture.name} — dm`, () => {
    assertEquals([...selectAuthorDmRelays(context)], [...fixture.expected.dm])
  })
}
