# Assistant tools

The CloudOS Assistant exposes the local VFS / desktop state to LLMs through
a typed tool layer. There are two parallel surfaces, sharing the same
underlying handlers:

| Surface | Who triggers it | Where it lives |
| ------- | --------------- | -------------- |
| **Slash commands** (`/read`, `/write`, `/mkdir`, …) | the user typing | `apps/desktop/src/stores/ai-tools.ts` (top half) |
| **LLM tool calls** (function-calling) | the configured LLM provider | `apps/desktop/src/stores/ai-tools.ts` (bottom half) + `ai-store.ts` |

Both surfaces run in the browser; nothing is sent to a server unless the
configured provider talks to one.

## Tool registry

| Tool | Args | Dangerous | What it does |
| ---- | ---- | --------- | ------------ |
| `read_file` | `path` | no | Reads a VFS file (4 KB cap). |
| `list_dir` | `path?` (default `/`) | no | Lists children of a VFS directory. |
| `stat` | `path` | no | Metadata: kind, mime, size, mtime, clock. |
| `find` | `pattern` | no | Case-insensitive substring search across all paths. |
| `storage_summary` | – | no | Total / trash / file / dir counts plus top folders. |
| `list_apps` | – | no | Installed CloudOS apps (id + name). |
| `list_windows` | – | no | Currently open windows with focus state. |
| `list_desktops` | – | no | Virtual desktops with active marker. |
| `now` | – | no | Local date + time as ISO string. |
| `vfs_clock` | – | no | Latest VFS clock + tombstone count. |
| `list_conflicts` | – | no | Unresolved sync conflicts. |
| `whoami` | – | no | Active profile (display name, email, avatar, bio). |
| `recent_apps` | – | no | Recently launched app ids (most recent first). |
| `write_file` | `path`, `content` | **yes** | Create / overwrite a file. |
| `mkdir` | `path` | **yes** | Create a directory. |
| `rm` | `path`, `hard?` | **yes** | Move to `/Trash` (or permanently delete with `hard:true`). |
| `mv` | `src`, `dst` | **yes** | Move into a directory or rename in place. |

The full JSON schema is emitted by `getToolsSchema()` in OpenAI / Ollama
shape (`{type: "function", function: {name, description, parameters}}`).
Anthropic's adapter (in `ai-store.ts`) flattens this into
`{name, description, input_schema}`.

## Provider compatibility

| Provider | Tool calling | Notes |
| -------- | ------------ | ----- |
| OpenAI | yes | Sends `tools[]` + `tool_choice: "auto"` to `/chat/completions`. |
| OpenAI-compatible | yes | Same as OpenAI; works with Groq, Cerebras, OpenRouter, Together, Fireworks, etc. |
| Anthropic | yes | Adapter converts to `{name, description, input_schema}`; results land in `tool_result` content blocks. |
| Ollama | conditional | Only when the configured model is on the `TOOL_CALLING_MODEL_PREFIXES` allow-list in `apps/desktop/src/stores/ollama-tools.ts`. |
| Echo | no | Offline mock; ignores `toolCallingEnabled`. |

The user opts in via Settings → **Let the LLM call CloudOS tools**. It is
off by default because not every model honours `tools[]` correctly.

## Confirmation gate

Mutating tools (`write_file`, `mkdir`, `rm`, `mv`) never run synchronously
when invoked. Each call returns a `ConfirmationPayload` and the chat UI
renders a per-call **Run** / **Cancel** button:

- **Run** → `executeConfirmedAction(payload)` mutates the VFS, the
  outcome text is recorded as the call's `result`, and the multi-turn
  loop resumes (LLM sees the result and can continue).
- **Cancel** → the call is marked cancelled with `result = "Cancelled by
  user — no changes made."`; the loop also resumes so the LLM can react
  (e.g. apologise, try a different path).

When **Always allow dangerous commands** is on (Settings →
**Dangerous commands**), the gate is bypassed for both slash commands
and LLM tool calls — useful for power users, easy to misfire, off by
default.

## Multi-turn loop

The provider loop in `runProviderLoop` runs up to
`TOOL_CALL_MAX_ITERATIONS` (5) round-trips per user message:

```
user message
  └─→ LLM (with tools[])
        └─→ tool calls?
              ├─ no  → append assistant text, done
              └─ yes → resolve each call:
                        ├─ read-only / always-allow → execute now
                        └─ dangerous + gated       → confirm via UI
                      pause until all resolved
                      append tool result messages
                      loop
```

Hitting the iteration cap surfaces an explicit warning rather than
quietly stopping. The cap exists to defend against models that
hallucinate endless tool calls.

## Wire formats

### OpenAI / Ollama / OpenAI-compatible

Request:

```json
{
  "model": "gpt-4o-mini",
  "messages": [...],
  "tools": [{ "type": "function", "function": { "name": "...", "parameters": {...} } }],
  "tool_choice": "auto"
}
```

Response (when calling tools):

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc",
        "type": "function",
        "function": { "name": "read_file", "arguments": "{\"path\":\"/notes.md\"}" }
      }]
    }
  }]
}
```

Tool result message:

```json
{ "role": "tool", "tool_call_id": "call_abc", "name": "read_file", "content": "..." }
```

### Anthropic

Request:

```json
{
  "model": "claude-3-7-sonnet-latest",
  "system": "...",
  "messages": [...],
  "tools": [{ "name": "...", "description": "...", "input_schema": {...} }],
  "max_tokens": 1024
}
```

Response (when calling tools):

```json
{
  "content": [
    { "type": "text", "text": "I'll read that file." },
    { "type": "tool_use", "id": "toolu_abc", "name": "read_file", "input": { "path": "/notes.md" } }
  ],
  "stop_reason": "tool_use"
}
```

Tool result message (note: as a `user` message, not a `tool` role):

```json
{
  "role": "user",
  "content": [
    { "type": "tool_result", "tool_use_id": "toolu_abc", "content": "..." }
  ]
}
```

The translation from internal wire format to Anthropic shape is handled
by `wireToAnthropic` in `ai-store.ts`.

## Adding a new tool

1. Add a `ToolDefinition` entry to the `tools` array in
   `apps/desktop/src/stores/ai-tools.ts`. Use a precise `description`
   — it's the only signal the LLM has about when to call it.
2. For read-only tools, return a tab-separated text result; this feeds
   cleanly into the `tool` role message back to the LLM (no markdown
   needed).
3. For mutating tools, factor a `prepare<Verb>` helper next to the
   existing ones and have both the slash command (if any) and the
   tool's `run` delegate to it. The helper returns either a
   `ConfirmationPayload` or a string error.
4. Add the new tool name to the documentation table above.

No registry rebuild is required — `getToolsSchema()` is rebuilt from
the array on every request.
