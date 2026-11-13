# Governance

cclink8 is a small, safety-sensitive developer tool. Governance is intentionally lightweight but explicit.

## Maintainers

- **BDFL (v0.1):** Cyber-Marty.
- After three external maintainers have shipped substantive changes, the project moves to a **3-maintainer committee** with lazy consensus.
- Maintainer responsibilities: triage, review, releases, security response, and keeping the terminal matrix current.

## Decisions

Technical and product decisions follow [DECISIONS.md](DECISIONS.md):

1. A proposal is written down with options and trade-offs.
2. At least two maintainers review; parser/opener changes need two approvals.
3. Decisions are recorded with the rationale and date.
4. No single owner changes scope, security posture, or release policy unilaterally.

## Releases

- Semver. `0.x` may change behavior; breaking changes get a minor bump.
- Every release: build on Windows/macOS/Linux, run tests, validate the plugin, update CHANGELOG.
- v0.1.0 requires a real TUI click test on Windows Terminal and VS Code.
- Release artifacts are built from a signed tag; npm provenance is enabled when npm publishing is available.

## Scope discipline

cclink8 is a link renderer and opener. It does not become a file manager, previewer, tracker, cloud service, or local HTTP server. Scope changes require a recorded decision.

## Funding

No VC funding. Optional GitHub Sponsors/Open Collective for maintenance; the core stays free and Apache-2.0.

## Trademark

Do not imply that cclink8 is an Anthropic product. Claude and Claude Code are trademarks of Anthropic.
