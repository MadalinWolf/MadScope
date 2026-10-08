# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

MadScope is a local testing tool, but it launches a real Chromium instance and processes untrusted web content. If you find something that could harm users (e.g. command injection via URLs/config, unsafe handling of page content, credential leakage in logs), report it privately:

- Open a [private security advisory](https://github.com/MadalinWolf/MadScope/security/advisories/new), or
- Contact the maintainer via the profile email on https://github.com/MadalinWolf

What to include: MadScope version, OS, steps to reproduce, and what you expected to happen. Please do not include secrets, cookies, or tokens in the report — redact them.

## Scope Notes

- MadScope never sends your data anywhere (local-first), but the pages you test can execute JavaScript inside the test browser, like any browser would.
- Never run `madscope` against URLs you do not trust while sensitive local services are exposed without authentication.
- Do not commit `.madscope/` screenshots of authenticated pages to public repos — they may contain session-identifying pixels.
