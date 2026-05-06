# Oracle Cloud Always Free A1 capacity auto-retry

Oracle's "Always Free" ARM Ampere A1 shapes are capacity-constrained — at
peak times the API will reject `LaunchInstance` calls with `Out of host
capacity for shape VM.Standard.A1.Flex`. The wait can stretch from a few
minutes to several days depending on the region.

This repo includes a hands-off retry mechanism:

- [`scripts/launch-oracle-vm.py`](../scripts/launch-oracle-vm.py) — single
  attempt that returns 0 on capacity errors so cron does not flag a
  failure.
- [`.github/workflows/oracle-vm-retry.yml`](../.github/workflows/oracle-vm-retry.yml)
  — runs the script every 10 minutes, opens a GitHub issue when an
  instance is finally launched, and disables itself afterwards.

You only have to wire up the secrets once. After that it is fully
automated; you do not need to keep a laptop or VPS running.

## What you need before starting

- A working Oracle Cloud account (see [PUBLIC_HOSTING.md §1](./PUBLIC_HOSTING.md))
- A VCN with a public subnet (see [PUBLIC_HOSTING.md §2](./PUBLIC_HOSTING.md))
- An SSH public key you intend to log in with
- Access to this GitHub repository's **Settings → Secrets and variables
  → Actions** page

## Step 1 — Generate an Oracle API key

1. In the Oracle Cloud Console, click your profile avatar (top right) →
   **My profile**.
2. In the left navigation under **Resources**, click **API keys**.
3. **Add API key** → **Generate API key pair** → **Download private key**.
   Save `privateKey.pem` somewhere safe; you will paste its contents into
   GitHub as a secret in a moment.
4. Click **Add**. Oracle shows a "Configuration file preview" modal with
   four values:

   ```
   user=ocid1.user.oc1..aaaa...
   fingerprint=xx:xx:xx:...:xx
   tenancy=ocid1.tenancy.oc1..aaaa...
   region=ap-singapore-2
   ```

   Copy these to a scratch file — you will need them as secrets.

## Step 2 — Look up the remaining OCIDs

You will need four more values. The easiest route is the Console.

### Compartment OCID

Console → **Identity & Security** → **Compartments**. Click your **root
compartment** (it is named after your tenancy). Copy the **OCID**.

### Availability domain

Console → **Compute** → **Instances** → look at any instance, or use
**Governance & Administration → Tenancy details → Region management** to
list domains. Format looks like `dKwl:AP-SINGAPORE-2-AD-1`. Copy the
full string including the prefix.

If you only have one AD in the region (e.g. `ap-singapore-2`) the value
is whatever is shown on the Create Instance form's **Placement** section.

### Subnet OCID (public subnet)

Console → **Networking** → **Virtual Cloud Networks** → click your VCN
(e.g. `cloudos-vcn`) → click the public subnet → copy the **OCID**.

### Image OCID (Ubuntu 24.04 ARM)

Image OCIDs are region-specific. The fastest route:

1. Console → **Compute** → **Custom Images** → **Switch to Platform Images**.
2. Filter operating system **Canonical Ubuntu**, version **24.04**,
   architecture **aarch64**.
3. Open the most recent build (e.g. `Canonical-Ubuntu-24.04-aarch64-2026.04.30-1`)
   and copy the **OCID**.

If the Console hides the OCIDs, an alternative is the API:

```bash
oci compute image list \
  --compartment-id <YOUR_TENANCY_OCID> \
  --operating-system "Canonical Ubuntu" \
  --operating-system-version "24.04" \
  --shape "VM.Standard.A1.Flex" \
  --sort-by TIMECREATED --sort-order DESC --limit 1 \
  --query 'data[0].id' --raw-output
```

## Step 3 — Add GitHub secrets

In this repository: **Settings → Secrets and variables → Actions →
New repository secret**. Add each of the following:

| Secret name | Value |
| --- | --- |
| `OCI_USER_OCID` | `user=...` from Step 1 |
| `OCI_FINGERPRINT` | `fingerprint=...` from Step 1 |
| `OCI_TENANCY_OCID` | `tenancy=...` from Step 1 |
| `OCI_REGION` | e.g. `ap-singapore-2` |
| `OCI_PRIVATE_KEY` | full contents of `privateKey.pem` (BEGIN/END lines) |
| `OCI_COMPARTMENT_OCID` | from Step 2 (root compartment usually) |
| `OCI_AVAILABILITY_DOMAIN` | e.g. `dKwl:AP-SINGAPORE-2-AD-1` |
| `OCI_SUBNET_OCID` | public subnet OCID from Step 2 |
| `OCI_IMAGE_OCID` | Ubuntu 24.04 aarch64 image OCID for your region |
| `OCI_SSH_PUBLIC_KEY` | single-line `ssh-ed25519 AAAA... cloudos` |

The workflow uses the built-in `GITHUB_TOKEN` to open the success issue
and disable itself; no additional GitHub secret is required.

## Step 4 — Trigger the workflow

1. Go to the **Actions** tab → **Oracle ARM A1 capacity retry** →
   **Enable workflow** (GitHub disables scheduled workflows in forks by
   default; this also wakes it up on private repos that have not run it
   before).
2. Click **Run workflow** to fire the first attempt immediately. From
   then on cron runs it every 10 minutes.

## What happens on success

When `LaunchInstance` succeeds the workflow:

1. Logs the new instance's OCID and display name to the run output.
2. Opens a GitHub issue tagged `infrastructure` / `oracle-cloud`
   summarising the launch and pointing back to
   [`docs/PUBLIC_HOSTING.md`](./PUBLIC_HOSTING.md) for next steps.
3. Disables the retry workflow with `gh workflow disable` so further
   cron ticks do not create duplicate VMs.

You'll get the GitHub issue notification by email if you have GitHub's
default notification settings.

## Tweaking shape, region, etc.

The script reads `OCI_OCPUS`, `OCI_MEMORY_GB`, and `OCI_BOOT_VOLUME_GB`
as optional env vars (defaults: 4, 24, 50). The workflow exposes the
first two as `workflow_dispatch` inputs so you can launch a manual
attempt with smaller shape (e.g. 1 OCPU + 6 GB) without editing the
file. To switch regions, update `OCI_REGION`, `OCI_AVAILABILITY_DOMAIN`,
`OCI_SUBNET_OCID`, and `OCI_IMAGE_OCID` together — they all need to
match.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Workflow run logs `missing required env var: OCI_PRIVATE_KEY` | Secret not added or pasted with extra surrounding whitespace. Re-paste the full PEM including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines. |
| `NotAuthenticated` / `InvalidParameter user` | `OCI_FINGERPRINT` does not match the API key uploaded in Step 1. Regenerate the key pair and re-paste both `OCI_PRIVATE_KEY` and `OCI_FINGERPRINT`. |
| `LimitExceeded` | You already have an Always Free A1 instance taking up the quota. Terminate the old one or accept paying for the new one. |
| `InvalidParameter availabilityDomain` | The AD string is region-specific — the prefix (e.g. `dKwl:`) is part of the value. Copy it verbatim from the Console. |
| Cron stops firing | Private GitHub repos pause scheduled workflows after 60 days of inactivity. Push any commit to `main` (or open the workflow and click **Enable workflow**) to wake it up. |
| Issue notification did not arrive | Check your GitHub notification settings; alternatively, watch the Actions tab — a green run with `success=true` step output also indicates a successful launch. |

## Security notes

- The `OCI_PRIVATE_KEY` secret grants full API access to your Oracle
  account. Treat it like a root password. Revoke it from the Console as
  soon as you no longer need the auto-retry workflow (Profile → API
  keys → delete).
- The workflow only calls `LaunchInstance`. If you want to harden it
  further, scope a dedicated IAM user with a policy that only allows
  `manage instance-family in compartment cloudos-prod` and use that
  user's API key instead of your tenancy admin key.
- `GITHUB_TOKEN` is short-lived and scoped only to this repository — no
  separate PAT is needed.
