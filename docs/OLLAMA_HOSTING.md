# Self-hosting Ollama for the CloudOS Assistant

This guide walks through running Ollama 24/7 on **Oracle Cloud Always
Free** so the CloudOS Assistant has a private LLM endpoint that you
control, without monthly bills. The recommended path uses **Cloudflare
Tunnel** instead of a public IP — that keeps your Ollama instance off
the open internet entirely.

> If you don't need self-hosting and are happy with hosted free
> providers, the Assistant ships with presets for Groq, Cerebras,
> OpenRouter, and Gemini that work out of the box. See
> [API.md](./API.md) and the in-app **Settings → Provider** picker.

## What you'll have at the end

- An Ubuntu 22.04 ARM VM on Oracle Cloud Always Free (4 OCPU, 24 GB
  RAM, 0/month forever).
- Ollama running as a systemd service, bound to `127.0.0.1:11434`.
- A Cloudflare Tunnel exposing it at
  `https://ollama.your-domain.com` with TLS and access policies.
- A heartbeat cron job that keeps the VM out of Oracle's idle-reclaim
  pool.
- A Settings entry in CloudOS Assistant pointing at your tunnel URL.

## What this guide does NOT do for you

- It does not sign you up for Oracle Cloud (requires identity + a
  credit card for verification).
- It does not buy you a domain — you'll need a domain you control on
  Cloudflare DNS for the tunnel step.
- It does not perform any of the Oracle / Cloudflare provisioning
  inside Devin — those happen in your own browser.

## Prerequisites

- An Oracle Cloud Always Free tenancy. Sign up at
  <https://signup.cloud.oracle.com/>. Pick a Home Region close to
  where you'll use it the most (matters for latency, less for cost).
  The signup wants a credit card for identity verification but
  Always Free resources are never charged.
- A domain on Cloudflare. The free DNS plan is enough.
- An SSH client and ~30 minutes.

## 1. Provision the VM

Oracle's web UI changes regularly; the canonical reference is
<https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm>.
The high-level steps:

1. Compute → **Instances** → **Create instance**
2. **Image and shape**:
   - Image: **Canonical Ubuntu 22.04** (ARM build)
   - Shape: **Ampere** → `VM.Standard.A1.Flex`
   - Set **OCPUs = 4** and **Memory = 24 GB**. This is the maximum
     Always Free A1 shape and it stays at $0/month.
3. **Networking**: take the defaults (a new VCN with internet gateway).
4. **SSH keys**: paste your public key (`~/.ssh/id_ed25519.pub`).
5. **Boot volume**: keep at 47 GB (Always Free includes 200 GB total
   block storage).
6. **Create**.

When the instance is running, note its **Public IP** and SSH in:

```bash
ssh ubuntu@<PUBLIC_IP>
```

Update the box and reboot:

```bash
sudo apt update && sudo apt -y full-upgrade
sudo reboot
```

## 2. Install Ollama

Ollama publishes ARM64 binaries directly. Run the official installer:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

The installer creates an `ollama` system user and a systemd unit at
`/etc/systemd/system/ollama.service`. Verify it's running:

```bash
systemctl status ollama
curl -s http://127.0.0.1:11434/api/version
# → {"version":"0.x.x"}
```

By default Ollama listens on `127.0.0.1:11434` only — that's exactly
what we want, because Cloudflare Tunnel will forward to localhost.
**Do not** change `OLLAMA_HOST` to `0.0.0.0` unless you have a
specific reason to expose the port directly; doing so without auth
would put an unauthenticated LLM on the public internet.

## 3. Pull a model

ARM Ampere A1 has no GPU; inference runs on CPU. For interactive
chat, prefer 7-8B models at Q4_K_M quantization:

```bash
# 5 GB on disk, 5-12 tok/s on 4 OCPU — recommended default
ollama pull llama3.1:8b

# 5 GB on disk, similar perf, sometimes nicer at instruction following
ollama pull qwen2.5:7b

# Optional larger model — 9 GB, ~3-5 tok/s, slower but smarter
ollama pull qwen2.5:14b
```

Smoke-test from the box:

```bash
ollama run llama3.1:8b "Say hi in one sentence."
```

## 4. Configure CORS and origins

CloudOS runs in a browser, so Ollama needs to allow cross-origin
requests from wherever you serve CloudOS from. Edit the systemd
override:

```bash
sudo systemctl edit ollama
```

Paste:

```ini
[Service]
Environment="OLLAMA_ORIGINS=https://cloudos.your-domain.com,https://*.your-domain.com"
# Optional: keep the default 127.0.0.1 bind. Only override if you
# really need wildcard binding — and if you do, put it behind a
# reverse proxy that requires auth.
# Environment="OLLAMA_HOST=127.0.0.1:11434"
```

Reload + restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

## 5. Cloudflare Tunnel (recommended)

This is how you get a public HTTPS URL for the Assistant to talk to,
without ever exposing port 11434 to the open internet.

1. Log in to <https://one.dash.cloudflare.com/> → **Networks** →
   **Tunnels** → **Create a tunnel**.
2. Pick **Cloudflared** as the connector. Name it `ollama-home` (or
   similar) and copy the install command Cloudflare gives you. It
   looks like:

   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
   sudo dpkg -i cloudflared.deb
   sudo cloudflared service install <YOUR_TOKEN>
   ```

   Run those on the Oracle VM.
3. Back in the Cloudflare dashboard, in the tunnel's **Public
   Hostname** tab, add a route:
   - Subdomain: `ollama`
   - Domain: `your-domain.com`
   - Service: `HTTP` → `localhost:11434`
4. Save. Within ~30 seconds the tunnel is live; verify from your
   laptop:

   ```bash
   curl -s https://ollama.your-domain.com/api/version
   ```

### Recommended: lock the tunnel down

Anyone who guesses the hostname can hit your Ollama unless you add
an access policy:

- Cloudflare dashboard → **Zero Trust** → **Access** → **Applications**
  → **Add an application** → **Self-hosted** → enter the same
  hostname.
- Add a policy that requires **Email is** _your-email@example.com_
  (or your team's emails). Cloudflare will email a one-time code
  before the request is forwarded.
- For browser-only requests like CloudOS Assistant, you may need to
  use a **service token** — see
  <https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/>
  and pass the `CF-Access-Client-Id` / `CF-Access-Client-Secret`
  headers. Today the CloudOS Assistant doesn't have a UI for adding
  custom request headers; track this if you need it.

A simpler alternative for solo use is to leave Cloudflare's basic
TLS in place and rely on a hard-to-guess hostname (e.g.
`ollama-9f3a2b.your-domain.com`). This is "security by obscurity"
and is fine for a personal lab but **do not** use it for anything
sensitive.

## 6. (Alternative) Direct exposure with ufw + IP allowlist

If you don't want Cloudflare in the loop, you can expose Ollama
directly. **Strongly discouraged** for production-ish use, because
Ollama has no built-in auth.

```bash
# In /etc/systemd/system/ollama.service.d/override.conf:
# Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow from <YOUR_HOME_IP>/32 to any port 11434 proto tcp
sudo ufw enable
```

You also need to open the port in **Oracle's Security List**:
Networking → Virtual Cloud Networks → your VCN → Security Lists →
Default Security List → **Add Ingress Rule**, source `<YOUR_HOME_IP>/32`,
protocol TCP, destination port 11434.

Without the Oracle Security List rule, ufw alone won't make the port
reachable — Oracle's network is double-firewalled.

## 7. Anti-reclaim heartbeat

Oracle reserves the right to reclaim Always Free compute instances
that show no activity for an extended period (in practice, ~7 days
of CPU near-idle). A trivial cron job that wakes Ollama once an
hour is enough to keep the VM in the active pool:

```bash
sudo tee /etc/cron.hourly/ollama-heartbeat <<'BASH'
#!/usr/bin/env bash
curl -fsS http://127.0.0.1:11434/api/version > /dev/null
ollama list > /dev/null
BASH
sudo chmod +x /etc/cron.hourly/ollama-heartbeat
```

That's it — the heartbeat hits two endpoints, Ollama touches its
model registry on disk, and Oracle's reclaim heuristic sees activity.

## 8. Wire up the CloudOS Assistant

1. Open CloudOS in your browser, click the Assistant.
2. **Settings → Provider** → **Ollama**.
3. **Base URL** → `https://ollama.your-domain.com` (no trailing
   slash, no `/api`).
4. **Model** → click **Refresh** to populate the dropdown from your
   Ollama instance, then pick `llama3.1:8b` (or whatever you
   pulled).
5. **API key** → leave empty.
6. Send a test message: `Say hi in one sentence.` You should see a
   response in 1-3 seconds.

If the model dropdown doesn't populate, the most likely cause is the
`OLLAMA_ORIGINS` environment variable — it must include the **exact**
origin (scheme + host) that CloudOS is loaded from in the browser.

## 9. Operational tips

- **Update Ollama**: `curl -fsSL https://ollama.com/install.sh | sh`
  again. The installer detects upgrades and restarts the service.
- **Rotate models**: `ollama rm <name>` to free disk before
  `ollama pull <new-name>`. The Always Free 47 GB boot volume holds
  ~5 small models comfortably.
- **Check usage**: `htop`, `df -h`, `journalctl -u ollama -e`.
- **Cost monitoring**: Oracle Cloud → Billing → Cost Analysis.
  Always Free resources should always show 0/month. If you see a
  charge, you likely provisioned a paid shape by mistake — check
  the instance's shape against the Always Free list.

## 10. Troubleshooting

| Symptom                                              | Likely cause                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `curl http://127.0.0.1:11434/api/version` hangs      | systemd unit not running; check `systemctl status ollama`                 |
| Tunnel hostname returns 502                          | `cloudflared` service not running on the VM; `systemctl status cloudflared` |
| Browser console shows CORS error                     | `OLLAMA_ORIGINS` doesn't match the CloudOS origin exactly                 |
| Slow generation (<1 tok/s)                           | Model too large for 4 OCPU CPU-only; switch to an 8B Q4_K_M model         |
| `ollama pull` fails with `no space left on device`   | Boot volume full; `ollama rm <unused-models>` or expand block volume      |
| Instance disappears after a few weeks                | Reclaimed by Oracle; recreate and add the heartbeat cron from step 7      |
| `cloudflared` install fails on ARM64                 | Use the `cloudflared-linux-arm64.deb` URL (NOT `amd64`)                   |

## Costs at a glance

Oracle Cloud Always Free tier, with the recommended shape:

| Resource                  | Always Free quota                | This guide uses        |
| ------------------------- | -------------------------------- | ---------------------- |
| Ampere A1 OCPUs           | 4 OCPUs total                    | 4                      |
| Ampere A1 memory          | 24 GB total                      | 24 GB                  |
| Block storage             | 200 GB total                     | 47 GB (boot volume)    |
| Outbound data transfer    | 10 TB/month                      | <1 GB/month typical    |
| VCN, subnet, public IP    | Free                             | 1 of each              |

Cloudflare's free tier covers DNS, the tunnel, and basic Access
policies for up to 50 users.

## Cross-references

- [SELF_HOSTING.md](./SELF_HOSTING.md) — self-hosting the CloudOS
  shell + backend (a separate concern from this doc).
- [API.md](./API.md) — provider preset shapes used by the Assistant.
- [GETTING_STARTED.md](./GETTING_STARTED.md) — running CloudOS
  locally, useful before pointing it at a remote Ollama.
