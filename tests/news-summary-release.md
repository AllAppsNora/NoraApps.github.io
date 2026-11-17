# Daily news summaries

The existing 06:00 Istanbul RSS job now generates a shared 100–150-word Turkish paraphrase. The 07:00 retry reuses a completed summary. It can retry a failed summary once; it cannot spend per-reader tokens. No learning quota or account table changes.

- Model: claude-haiku-4-5-20251001, at most 1,100 output tokens per attempt, input text capped at 18,000 characters.
- Original article content comes from RSS or the source HTML (JSON-LD and article paragraphs are compared because JSON-LD can contain a truncated excerpt).
- A service-only RPC leases today's news; anonymous and signed-in end users cannot call it. Two automatic attempts maximum per news item, with cooldown. Usage counts persist for both failed and successful provider responses.
- 100–150 whitespace-separated words are enforced in JavaScript and PostgreSQL. Truncated output, unfinished sentences, and substantial copied phrases are rejected. A failure preserves existing text.
- Source URLs and each redirect must use HTTPS and a configured publication host. Article bodies are transient; only the paraphrase is persisted.

Validation: `node tests/news-summary.mjs`; rolled-back SQL checks for duplicate claim and short-output rejection; SQL privilege check for anonymous/authenticated access. Live deployment tested through the existing scheduler command, without revealing credentials. During installation, failed jobs were reopened explicitly to retest extraction/prompt fixes; normal cron retains the two-attempt limit.
