# Hosting CloudOS publicly — Oracle Cloud Always Free + Cloudflare

End-to-end guide to running a publicly accessible CloudOS instance for
**$0/month** of compute (Oracle Cloud Always Free) plus only the cost
of a domain name (~$10/year).

The result: anyone visiting `https://cloudos.your-domain.com` from any
device (desktop, Android, iOS) lands on your CloudOS desktop, can sign
in, and — if their browser supports it — install the page as a PWA so
it behaves like a native app.

> **Already have a VPS?** Skip section 1; jump to
> [§5 Provision the stack](#5-provision-the-stack-on-the-vm).
> The compose file is portable across any Linux host with Docker.

> **Just want to self-host for one user / your team on existing
> hardware?** Read [`SELF_HOSTING.md`](./SELF_HOSTING.md) instead — it
> assumes you already have a VPS and a domain.

> **Want to host the AI Assistant's LLM backend separately?** See
> [`OLLAMA_HOSTING.md`](./OLLAMA_HOSTING.md) for an Ollama-on-Oracle
> guide that runs alongside this one.

## Prerequisites checklist

Before you start, you should have:

- [ ] A credit/debit card (Oracle uses it to verify identity — they
      explicitly do **not** charge it for the Always Free tier, but a
      valid card is required to sign up)
- [ ] A phone number that can receive SMS for Oracle's 2FA
- [ ] A domain name you control (Cloudflare Registrar or any other
      registrar). If you don't have one, see
      [§3 Buy a domain](#3-buy-a-domain-and-point-it-at-cloudflare).
- [ ] A GitHub Personal Access Token (PAT) with `read:packages` scope
      — needed because `yowanda/cloudos` is currently a private repo
      and so are the GHCR images. See [§5.4](#54-log-in-to-ghcr).

## 1. Sign up for Oracle Cloud Always Free

The Always Free tier includes a generous ARM Ampere A1 allotment (4
OCPUs, 24 GB RAM total, splittable across up to 4 VMs) plus 200 GB of
block storage and 10 TB/month egress. It's easily the most generous
free cloud tier as of 2026 and is what this guide builds on.

1. Visit <https://cloud.oracle.com/free>.
2. Click **Start for free**.
3. Pick:
   - **Country / Territory:** match where the card is issued.
   - **Home region:** pick the one geographically closest to your
     users. Note: this is **permanent** — you can't change the home
     region later. For SE Asia: `ap-singapore-1`. For US East:
     `us-ashburn-1`. For EU: `eu-frankfurt-1`.
4. Verify your email with the code Oracle sends.
5. Verify your phone with the SMS code.
6. **Add billing details** (the card). Oracle will not charge it
   unless you explicitly upgrade past the Always Free limits — and the
   account will refuse to create paid resources by default.
7. Wait for "Account is being provisioned" to complete (typically 5–15
   minutes; can take up to an hour at peak times).
8. Sign in to <https://cloud.oracle.com>.

## 2. Launch an ARM Ampere A1 VM

The same A1 capacity is shared globally across all Always Free users,
so the popular regions (Frankfurt, Ashburn, Singapore) frequently
return "Out of capacity". If your first launch fails, retry every few
hours — capacity opens up regularly. There is also a script people
share publicly that retries automatically; use it at your own risk.

1. From the Oracle Cloud Console, click the hamburger menu →
   **Compute** → **Instances**.
2. Click **Create instance**.
3. **Name:** `cloudos-prod` (or whatever).
4. **Image:** click **Change image**, then **Canonical Ubuntu**, then
   pick the **22.04** ARM build (the page will be filtered to
   ARM-compatible images automatically once you select an A1 shape).
5. **Shape:** click **Change shape**, scroll to the **Ampere** family,
   pick **VM.Standard.A1.Flex**, then dial in **4 OCPUs** and
   **24 GB memory**. The whole VM is still Always Free at that size.
6. **Networking:** accept the default VCN (`vcn-...`) — Oracle will
   create one. **Important:** check "Assign a public IPv4 address".
7. **SSH keys:** either upload your own `~/.ssh/id_ed25519.pub` or
   click **Generate a key pair** and download both the public and
   private keys. You'll need the private key on your laptop to SSH in.
8. **Boot volume:** leave defaults. 50 GB free is plenty for now.
9. Click **Create**. Wait ~1 minute for the VM to spin up.
10. Once the instance state is **RUNNING**, copy the **Public IP
    address** from the right-hand panel. You'll use it in §3.

### 2.1. Open ports 80 and 443

Oracle's default Security List closes everything except port 22.
Caddy needs 80 (Let's Encrypt HTTP-01 challenge) and 443 (HTTPS).

1. Click the **Subnet** link on your instance's detail page (under
   "Primary VNIC").
2. Click the **Default Security List for vcn-...**.
3. Click **Add Ingress Rules** and add two:
   - Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `80`
   - Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `443`
4. Click **Add Ingress Rules** to save.

### 2.2. (Ubuntu only) Open the same ports in iptables

Oracle's Ubuntu image ships with `iptables` rules that drop everything
except 22. SSH in and fix it:

```bash
ssh -i ~/.ssh/<private-key> ubuntu@<public-ip>
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

(Reboot-survival is via the `iptables-persistent` package, which is
pre-installed on the Oracle Ubuntu image.)

## 3. Buy a domain and point it at Cloudflare

You can use any registrar, but Cloudflare Registrar sells domains at
exactly the wholesale price (no markup) and bundles in DNS hosting +
proxy + DDoS protection for free. ~$10–12/year for a `.com`.

1. Visit <https://www.cloudflare.com/products/registrar/> and sign in
   (create a Cloudflare account first if needed).
2. Search the domain you want, add to cart, pay.
3. After registration completes (usually 5–10 minutes), click your
   domain in the Cloudflare dashboard and go to **DNS** → **Records**.
4. Click **Add record**:
   - **Type:** `A`
   - **Name:** `cloudos` (so the full hostname becomes
     `cloudos.your-domain.com`; use `@` if you want apex/root).
   - **IPv4 address:** the Oracle public IP from §2.
   - **Proxy status:** ⚠️ **DNS only** (grey cloud). Don't enable the
     orange cloud yet — Caddy needs to see the real client IP for the
     Let's Encrypt HTTP-01 challenge to work. You can flip the proxy
     on later, after TLS is set up, by switching Caddy to use
     Cloudflare's API for ACME DNS-01 instead.
5. Click **Save**.

Verify DNS propagated:

```bash
# On your laptop (not the VM):
dig +short cloudos.your-domain.com   # expect the Oracle IP
```

## 4. Install Docker on the VM

```bash
ssh ubuntu@<public-ip>

# Docker
curl -fsSL https://get.docker.com | sudo sh

# Let your user run docker without sudo (re-login after this)
sudo usermod -aG docker $USER
exit
ssh ubuntu@<public-ip>

# Sanity check
docker run --rm hello-world
```

## 5. Provision the stack on the VM

### 5.1. Pick a working directory

```bash
sudo mkdir -p /opt/cloudos
sudo chown $USER /opt/cloudos
cd /opt/cloudos
```

### 5.2. Get the deploy assets

Because the repo is private, clone via HTTPS with your PAT (set
`GITHUB_PAT` in the shell first — never echo or commit it):

```bash
read -s -p "GitHub PAT: " GITHUB_PAT && echo
git clone https://yowanda:${GITHUB_PAT}@github.com/yowanda/cloudos.git src
cp src/deploy/docker-compose.prod.yml docker-compose.yml
cp src/deploy/Caddyfile.prod Caddyfile
cp src/deploy/.env.example .env
unset GITHUB_PAT      # don't leave it in the shell history
```

(The `src/` clone gives you a copy of the source tree on the VM in
case you want to inspect it; it's not used at runtime — the
docker-compose pulls images from GHCR.)

### 5.3. Configure secrets

```bash
$EDITOR .env
```

Mandatory edits (see comments inside the file):

- `DOMAIN=cloudos.your-domain.com`
- `PUBLIC_URL=https://cloudos.your-domain.com`
- `CORS_ORIGIN=https://cloudos.your-domain.com`
- `ACME_EMAIL=you@your-domain.com` — used by Let's Encrypt for expiry
  notices. Use a real address.
- `JWT_SECRET=$(openssl rand -hex 32)` — paste the output, don't keep
  the shell-substitution literal.
- `POSTGRES_PASSWORD=$(openssl rand -hex 24)`
- `MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)`
- `ADMIN_EMAILS=you@your-domain.com` — only listed addresses can review
  Developer Portal app submissions.
- `ALLOW_REGISTRATION=true` for the very first boot so you can sign
  yourself up. Flip it to `false` after registering and re-run
  `docker compose up -d` to lock the door.

Then in `Caddyfile`, the `{$DOMAIN}` and `{$ACME_EMAIL}` placeholders
are read from the environment automatically — no edits needed.

### 5.4. Log in to GHCR

GHCR images for this repo are private. Pull them with the same PAT:

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u yowanda --password-stdin
# (re-export GITHUB_PAT temporarily if you unset it earlier)
```

> **Tip — if you flip the repo to public later**, the GHCR images
> become anonymously pullable and you can skip this `docker login`
> step. Until then, every `docker compose pull` needs the PAT to be
> still logged in (it's saved at `~/.docker/config.json`).

### 5.5. Pin to a tagged release (recommended)

`latest` always tracks the most recent tag, but for predictable
deployments edit `.env` to pin a specific version:

```bash
echo "CLOUDOS_TAG=v0.2.0" >> .env  # replace with the version you want
```

Tags are visible at <https://github.com/yowanda/cloudos/releases>.
Until the first `v*.*.*` release tag is cut, leave it as `latest`.

### 5.6. Bring it up

```bash
docker compose pull
docker compose up -d
docker compose ps        # all services should be "running" / "healthy"
docker compose logs -f caddy server frontend
```

The first `caddy` boot will spend ~30–60 seconds talking to Let's
Encrypt to issue a cert. You'll see lines like
`certificate obtained successfully` once it's done.

### 5.7. Smoke-test from your laptop

```bash
# Browser:
open https://cloudos.your-domain.com

# Or curl:
curl -fsS https://cloudos.your-domain.com/api/v1/vfs/health
# → {"status":"ok","kind":"vfs"}
curl -fsS https://cloudos.your-domain.com/health
# → ok
```

Open the URL in a browser, register your first account, then on the VM
edit `.env` to set `ALLOW_REGISTRATION=false` and:

```bash
docker compose up -d   # restarts the server with the new flag
```

## 6. Lock things down

A few sensible follow-ups once you're up:

### 6.1. Cloudflare proxy + WAF (optional but recommended)

After Let's Encrypt has issued the cert, you can flip Cloudflare's
DNS record from "DNS only" (grey) to "Proxied" (orange) to get DDoS
protection and analytics. Two caveats:

1. The cert is now Cloudflare's edge cert; your origin Caddy still
   uses the LE cert. Set Cloudflare → SSL/TLS → Overview →
   **Encryption mode** to **Full (strict)**.
2. Future LE renewals via HTTP-01 will fail because Cloudflare
   intercepts port 80. Switch Caddy to ACME DNS-01 with a Cloudflare
   API token: see <https://caddyserver.com/docs/caddyfile/concepts#acme-dns-challenges>.

### 6.2. Fail2ban / SSH hardening

```bash
sudo apt update && sudo apt install -y fail2ban unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Edit `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
```
then `sudo systemctl reload ssh`.

### 6.3. Backups via cron

Wire `deploy/backup.sh` to cron — it dumps Postgres, mirrors MinIO,
copies the VFS dir, and bundles to `cloudos-<timestamp>.tar.zst`.

```cron
0 3 * * * BACKUP_DIR=/opt/cloudos/backups VFS_DATA_DIR=/opt/cloudos/data/vfs PG_HOST=localhost MC_ALIAS=cloudos /opt/cloudos/src/deploy/backup.sh >> /var/log/cloudos-backup.log 2>&1
```

(Tweak the env vars to match the volume mount paths your stack uses.)

Better yet: copy the resulting `.tar.zst` off the VM nightly via
`rclone` to e.g. Cloudflare R2 (10 GB free).

### 6.4. Pin a version, automate updates

When a new tagged release lands:

```bash
cd /opt/cloudos
$EDITOR .env                 # bump CLOUDOS_TAG=v0.3.0
docker compose pull
docker compose up -d
```

Alternatively run [Watchtower](https://containrrr.dev/watchtower/) in
the same compose file to auto-pull on a schedule. Pin to a major
version (`v0` or `v0.2`) in `.env` so a breaking minor doesn't roll
out to you unattended.

## 7. Mobile / PWA notes

CloudOS is built as an installable PWA, so once the URL is up:

- **Android Chrome:** the page automatically shows an "Add to Home
  screen" prompt the first time. The shell's manifest declares 3
  jump-list shortcuts (Files / Terminal / Settings) which Android
  surfaces as long-press menu entries on the home-screen icon.
- **iOS Safari:** tap **Share** → **Add to Home Screen**. Apple
  doesn't honour `display: standalone` jump-list shortcuts but the
  full shell still launches in a windowless tab.
- **Desktop Chrome / Edge:** an install button (⊕) appears in the URL
  bar. Click to install as a standalone PWA window.

The in-app `<InstallPrompt />` banner respects a 7-day suppression
window — if a user dismisses the install prompt, it won't show again
for a week (stored in `localStorage`).

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| Site loads but page is blank | Frontend image still building or `CORS_ORIGIN` wrong | `docker compose logs frontend server` and check the browser console |
| `502 Bad Gateway` | Caddy started before `frontend` / `server` were ready | Wait 30s; `docker compose ps` should show `(healthy)` |
| Cert provisioning fails | Port 80 / 443 blocked, or DNS not yet propagated | Check the iptables / VCN rules in §2; confirm `dig` returns the right IP |
| `pull access denied` from GHCR | Not logged in, or PAT lacks `read:packages` | `docker login ghcr.io -u yowanda --password-stdin` and verify PAT scopes |
| `manifest unknown` on `arm64` | Image hasn't been rebuilt with multi-arch enabled (release.yml landed in `8c21ac2` and later) | Re-tag a release after that commit; or build images locally on the VM (`docker compose build`) |
| Registration says `403 — Registration is closed` | `ALLOW_REGISTRATION=false` and you're trying to make a new account | Flip to `true`, restart, register, flip back to `false` |
| Login works but every API call returns `401` | `JWT_SECRET` rotated — old tokens are invalid | Sign out + sign in again; or regenerate the secret only when you intentionally want to invalidate all sessions |

## Cost summary

| Item | Cost |
| ---- | ---- |
| Oracle Cloud Always Free VM (4 OCPU ARM, 24 GB RAM) | $0 |
| Domain (Cloudflare Registrar, `.com`) | ~$10/year |
| Cloudflare DNS / proxy / WAF | $0 |
| Let's Encrypt cert | $0 |
| GHCR image storage (private) | $0 (under 500 MB free quota) |
| **Total** | **~$10/year** |

If Oracle Always Free runs out of A1 capacity in your region, the
closest paid alternative is Hetzner Cloud's CAX11 (€4/month, ARM, 4 GB
RAM) — same compose file, change nothing else.
