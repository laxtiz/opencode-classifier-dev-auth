# AGENTS.md

Provider plugin for [magpie](https://usemagpie.ai) / OpenCode: signs in to [classifier.dev](https://classifier.dev) (free keyless System One decision models) and turns it into provider `classifier`. Protocol reference: <https://classifier.dev/openapi.json>.

## The one rule that breaks the plugin

`index.mjs` must export **only** the plugin function (`ClassifierDevAuthPlugin`). magpie calls every function exported from the entry module as a plugin. Put helpers in module-local constants, or on `export const _internal` for tests.

## Decision models, not chat models

- All models carry `decides: true` and the provider `decide: true`: magpie offers them as routing-group classifiers and hides them from agents. Do not remove these flags or add chat models — the upstream cannot generate text.
- `npm: "@ai-sdk/openai-compatible"` is a placeholder; no chat request ever reaches it.
- Keep `X-Classifier-Share-Data: false` on loader requests unless the user turns the `share_data` option on. Off (default) keeps request content private at the standard quota; on, the service retains content for training and doubles the quota.

## Developing against the real magpie

- The folder is loaded in place (`magpie plugin add <path>`); nothing is installed. Every `magpie` CLI command loads the current folder contents, so edits apply on the next command. In the app, toggle the plugin off/on.
- To test without touching the user's real magpie (logins, config), run magpie in a sandbox:
  ```sh
  sb=$(mktemp -d)
  m() { env HOME=$sb XDG_CONFIG_HOME=$sb/.config XDG_CACHE_HOME=$sb/.cache MAGPIE_ADDR=127.0.0.1:3499 magpie "$@"; }
  m plugin add /path/to/opencode-classifier-dev-auth </dev/null
  m plugin --json   # load errors, hooks, models
  ```
- Host errors and `console.log` from the plugin appear as `plugin: …` lines; the `page-chat` lines on every command are unrelated noise from another plugin.

## Sign-in and identity

- Sign-in state lives in magpie's `plugin-auth.json`, keyed by provider id — not by the plugin path. Moving/renaming the folder is safe, but re-register it: `magpie plugin rm <old-path> && magpie plugin add <new-path>`.
- The default method is a `type: "api"` method with `keyless: true` whose `authorize` returns the service-accepted `unused` anonymous key at once, as magpie-community's zen-free does — no input box, no browser (on a plain api method magpie asks for a key, so `keyless` is what makes it answer instantly). The `type: "api"` method stays for `classifier_agent_…` workspace keys.
- `auth.usage` reads the workspace wallet at `GET /v1/account/balance`; anonymous accounts report no balance and make no request. A 401 marks the sign-in expired. Do not add quota windows based on guessed rate-limit paths.
