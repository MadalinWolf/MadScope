# Contributing to MadScope

Thanks for your interest. MadScope is MIT-licensed and local-first.

## Setup

```bash
npm install
npx playwright install chromium
npm test
```

## Guidelines

- Keep the core engine (`packages/core`, `packages/browser`) UI-agnostic.
- No fake functionality: if a button exists, it must work.
- Never log secrets (cookies, tokens, auth headers). Never commit `.env` or screenshots.
- Add/extend tests for viewport logic, scoring, diffing, and browser flows.
- Run `npx tsc --noEmit` and the test suite before opening a PR.
- Follow the existing code style (Prettier defaults, strict TypeScript).

## Project structure

See `README.md` and `docs/architecture.md`.
