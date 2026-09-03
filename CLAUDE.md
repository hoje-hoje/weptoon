# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-backend webtoon rating site hosted on GitHub Pages. No build step, no npm dependencies for the site itself — `index.html` and `admin.html` are single self-contained HTML files (inline `<script>`/`<style>`). Data lives in `data/webtoons.json`, which `admin.html` edits by committing directly to this repo through the GitHub REST API from the browser.

Do not introduce a build tool, bundler, or npm package for the site pages — keep `index.html` and `admin.html` as single files.

## Commands

There is no build/lint/test tooling for the site itself. The only script with dependencies is `update-episodes.mjs`, which needs Playwright to check non-Naver platforms:

```
npm install playwright   # only needed to run update-episodes.mjs locally
node update-episodes.mjs
```

This is normally run by `.github/workflows/weekly.yml` on a schedule, not manually.

## Architecture

**`config.js`** — the single source of runtime configuration, loaded before both HTML pages. Defines `window.CONFIG`: `repo` (owner/name/branch that `admin.html` commits to), `admins` (id/name/color used for review authorship and login), `supabase` (optional; comments + cross-device favorites — without it favorites are `localStorage`-only and comments are read-only), `genres`, `adultGenre`, `platforms` (color/host per platform, used to detect which parser `update-episodes.mjs` uses), `statuses`, and `newDays` (window for the "신작" badge). This file contains real credentials (GitHub owner, Supabase anon key) — never overwrite it wholesale; only ever add/adjust specific keys.

**`index.html`** — the public viewer. Fetches `data/webtoons.json` client-side, renders cards/genre rows/detail modal, computes average rating from each item's `reviews[]`, handles favorites (Supabase if configured, else `localStorage`), spoiler-tag rendering (`||text||`), and a shuffle/random view.

**`admin.html`** — the editor. Auth is a GitHub fine-grained personal access token pasted by the admin and kept in that browser only (one token per person, matched to an entry in `config.js#admins`). Saving writes directly to GitHub: it reads the current `data/webtoons.json` blob via the Contents API, mutates it, base64-encodes it, and PUTs it back with `ghPut()` (`admin.html:702`), which is a commit to the configured branch — there is no server. Cover uploads follow the same PUT-to-`contents/covers/...` pattern; `shrink()` (`admin.html:542`) downsizes images client-side before upload.

**`data/webtoons.json`** — the database. Shape: `{ "updated": "YYYY-MM-DD", "items": [...] }`. Each item carries `id`, `title`, `author`, `platform`, `url`, `genre`, `tags`, `covers` (array of `covers/<file>.jpg` paths), `status`, `weekday`, `episodes`, `seasons`, `start`, `autoUpdate`, `lastChecked`, `needsCheck`, `reviews[]` (per-admin rating + spoiler-taggable text), `comments[]`. `covers/` filenames are referenced by relative path from this file — renaming a cover file breaks that item's image without a corresponding JSON update.

**`update-episodes.mjs`** — run weekly by `.github/workflows/weekly.yml`. For each item with `autoUpdate` and a `url`, and not `완결`/`휴재`, picks a reader by hostname (`SITES` list): Naver is read via an unofficial JSON endpoint (`naver()`), every other platform is read by launching Playwright, clicking through to the episode list, and regex-scanning for the largest `N화` in page text (`biggestEpisode()`). Safety rails: a lower episode count than currently stored is ignored (treated as a misread), a jump of more than `MAX_JUMP` (30) episodes is ignored, and any failure just sets `needsCheck: true` without touching `episodes`. Only rewrites `data/webtoons.json` if something actually changed.
