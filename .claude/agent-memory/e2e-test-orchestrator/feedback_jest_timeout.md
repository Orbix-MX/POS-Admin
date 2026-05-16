---
name: Jest testTimeout required for NestJS E2E
description: NestJS module bootstrap + remote DB connection exceeds Jest's default 5000ms timeout; must set testTimeout in jest-e2e.json
type: feedback
---

Always add `"testTimeout": 60000` to `test/jest-e2e.json` for NestJS E2E test suites.

**Why:** The default Jest timeout is 5000ms. NestJS `Test.createTestingModule().compile()` plus a remote PostgreSQL connection (Neon in this project) takes 10–30 seconds. Without this, every test fails with "Exceeded timeout of 5000ms for a hook" before any actual test code runs.

**How to apply:** Whenever creating or modifying `test/jest-e2e.json`, ensure `"testTimeout": 60000` is present. For individual spec files that have unusually long operations, also consider `jest.setTimeout(60000)` at the top of the describe block as a belt-and-suspenders measure.
