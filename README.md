# opencode-classifier-dev-auth

[OpenCode](https://opencode.ai) provider plugin for [classifier.dev](https://classifier.dev) — zero-shot classification with TypeSafe System One typed answers. It also works in [magpie](https://usemagpie.ai) without changes.

The service answers typed questions about text, images, audio and video with calibrated probabilities. It does not generate chat text, so the plugin marks every model `decides: true`: magpie offers them as routing-group classifiers and hides them from agents' model lists.

## Models

| Model | Input | Purpose |
| --- | --- | --- |
| `classifier/jev-latest` | text | Latest System One decision model |
| `classifier/jev-preview` | text | Preview of the next Jev model |
| `classifier/imajev-4b` | image | Typed image decisions with abstention |
| `classifier/jev-omni` | text plus one image, audio or video file | Typed omni decisions |

The list is refreshed from [`GET /v1/models`](https://classifier.dev/openapi.json) for signed-in accounts. laya, kev and chunklaya are not part of the System One model list and are intentionally not included.

## Sign in

No key is needed. Add the plugin and press Enter at the optional key prompt:

```sh
magpie plugin add opencode-classifier-dev-auth
magpie plugin login classifier
```

- Empty input uses the free anonymous quota. The plugin stores the service's accepted `unused` placeholder; anonymous limits are per IP.
- A `classifier_agent_…` key from [classifier.dev/app/keys](https://classifier.dev/app/keys) is stored normally and uses workspace quota and credits.
- Any other value is normalized to the anonymous placeholder.

## Privacy and quotas

Every request sent by the plugin carries `X-Classifier-Share-Data: false`, so request content is not retained for training. This uses standard rather than doubled quotas: anonymous fast access is 3,000 classifications per minute and 20,000 per day. Workspace limits depend on the plan.

Anonymous sign-ins do not show a balance. A workspace key does: `magpie quota` reads its pre-paid wallet from classifier.dev and shows available and reserved funds.

## Protocol

Requests use `POST /v1/systemone`. The endpoint is wire-compatible with TypeSafe's System One API and accepts `state`, `model` and `questions`. Responses contain typed `answers` and token `usage`. `GET /v1/models` is public.

## License

MIT
