import { startFixtureServer } from "./server.ts";

const s = await startFixtureServer("D:/PROJECTS/MadScope/tests/fixtures", 8931);
console.log(`FIXTURE_UP ${s.url}`);
await new Promise(() => {});
