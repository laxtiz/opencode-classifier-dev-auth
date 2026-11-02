// OpenCode / magpie provider plugin for classifier.dev, a zero-shot
// classification service that speaks TypeSafe's System One wire protocol.
//
// Its models answer typed questions with calibrated probabilities and
// generate no text, so they are marked `decides: true`: magpie offers them
// as routing-group classifiers and hides them from agents' model lists.

const PROVIDER = "classifier"
const BASE = "https://classifier.dev"
const VERSION = "0.2.0"
const ANONYMOUS_KEY = "unused"
const WORKSPACE_PREFIX = "classifier_agent_"

const DEFAULT_MODELS = {
  "jev-latest": { name: "Classifier Jev latest" },
  "jev-preview": { name: "Classifier Jev preview" },
  "imajev-4b": { name: "Classifier Imajev 4B" },
  "jev-omni": { name: "Classifier Jev Omni" },
}

const baseModel = {
  limit: { context: 128000, output: 1 },
  tool_call: false,
  free: true,
  decides: true,
}

// Names are stable even if the public discovery list is briefly unavailable.
const NAMES = {
  "jev-latest": "Classifier Jev latest",
  "jev-preview": "Classifier Jev preview",
  "imajev-4b": "Classifier Imajev 4B",
  "jev-omni": "Classifier Jev Omni",
}

function apiKeyOf(auth) {
  // The service ignores any non-workspace key and serves the anonymous
  // per-IP quota. Keep empty keyless sign-ins working here as well.
  const key = typeof auth?.key === "string" ? auth.key.trim() : ""
  return key || ANONYMOUS_KEY
}

function clientHeaders() {
  return { "x-classifier-client": `opencode-classifier-dev-auth/${VERSION}` }
}

export const ClassifierDevAuthPlugin = async (input) => ({
  // The provider, and the models it has while nobody is signed in.
  config: async (cfg) => {
    cfg.provider ??= {}
    cfg.provider[PROVIDER] ??= {
      name: "classifier.dev",
      npm: "@ai-sdk/openai-compatible", // never used for chat; decides only
      api: `${BASE}/v1`,
      endpoint: `${BASE}/v1`,
      decide: true,
      website: BASE,
      keys: `${BASE}/app/keys`,
      models: Object.fromEntries(
        Object.entries(DEFAULT_MODELS).map(([id, m]) => [id, { ...baseModel, ...m }]),
      ),
    }
  },

  auth: {
    provider: PROVIDER,
    options: [
      {
        key: "share_data",
        label: "Share data for training",
        description:
          "Off (default): requests carry X-Classifier-Share-Data: false — private, standard quota. On: requests are retained for training and the quota doubles.",
        default: false,
      },
    ],
    methods: [
      {
        // an api method returning the preset key, as magpie-community's
        // zen-free does: magpie asks for a key on a plain `type: "api"`
        // method, but `keyless` runs `authorize` at once — no input box,
        // no browser. The service accepts this placeholder for the free
        // per-IP quota.
        type: "api",
        keyless: true,
        label: "Free access (no key needed)",
        placeholder: ANONYMOUS_KEY,
        authorize: async () => ({
          type: "success",
          key: ANONYMOUS_KEY,
          metadata: { mode: "anonymous" },
        }),
      },
      {
        type: "api",
        label: "Workspace key",
        placeholder: "classifier_agent_…",
      },
    ],

    async loader(getAuth) {
      const auth = await getAuth()
      if (auth?.type !== "api") return {}
      const key = apiKeyOf(auth)
      const shareData = input?.magpie?.option?.(PROVIDER, "share_data") === true
      return {
        baseURL: `${BASE}/v1`,
        async fetch(input, init) {
          const headers = new Headers(init?.headers)
          headers.set("authorization", `Bearer ${key}`)
          // Private by default; the service doubles the quota when shared.
          if (!shareData) headers.set("x-classifier-share-data", "false")
          for (const [k, v] of Object.entries(clientHeaders())) headers.set(k, v)
          return fetch(input, { ...init, headers })
        },
      }
    },

    // Anonymous accounts have no balance to read. Workspace keys use the
    // pre-paid wallet: magpie shows a balance window, not a used/limit one.
    async usage(getAuth) {
      const auth = await getAuth()
      const key = typeof auth?.key === "string" ? auth.key.trim() : ""
      if (auth?.type !== "api" || !key.startsWith(WORKSPACE_PREFIX)) {
        return { plan: "Anonymous", windows: [] }
      }
      let res
      try {
        res = await fetch(`${BASE}/v1/account/balance`, {
          headers: { authorization: `Bearer ${key}` },
        })
      } catch (e) {
        return { error: `classifier.dev unreachable: ${e}`, windows: [] }
      }
      if (!res.ok) {
        const error = { error: `classifier.dev answered ${res.status}`, windows: [] }
        if (res.status === 401) error.signIn = "expired"
        return error
      }
      const account = await res.json()
      const available = Number(account.available)
      if (!Number.isFinite(available)) {
        return { error: "classifier.dev returned an unreadable balance", windows: [] }
      }
      const reserved = Number(account.reserved) || 0
      const money = (n) => `$${n.toFixed(2)}`
      return {
        plan: "Workspace",
        balance: money(available),
        windows: [
          {
            name: "Wallet",
            balance: available,
            unit: "USD",
            display: `${money(available)} available · ${money(reserved)} reserved`,
          },
        ],
      }
    },
  },

  // The published models of this account. Discovery is public.
  provider: {
    id: PROVIDER,
    async models(provider, { auth } = {}) {
      if (auth?.type !== "api") return provider.models
      let list
      try {
        const res = await fetch(`${BASE}/v1/models`, { headers: clientHeaders() })
        if (!res.ok) return provider.models
        list = (await res.json()).models ?? []
      } catch {
        return provider.models // magpie keeps the previous list
      }
      const out = {}
      for (const model of list) {
        const short = model.name
        if (!short || !NAMES[short]) continue
        out[short] = { ...baseModel, id: short, name: NAMES[short] }
      }
      return Object.keys(out).length ? out : provider.models
    },
  },
})
