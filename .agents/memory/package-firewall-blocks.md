---
name: Package firewall blocks
description: How a CVE-blocked npm dependency version silently breaks deployments and local installs on Replit.
---

# Package firewall blocks (Replit Socket Security)

When a dependency version is flagged by Replit's Socket Security policy, downloads
return `403 Forbidden ... package-firewall.replit.local ... Blocked by Security Policy`
(reason: Critical CVE).

**Why it matters:** `npm install` does full dependency-tree reconciliation. If ANY
declared dependency version is blocked, the *entire* install fails — even when you
are installing an unrelated package, and even during the deployment build step. So a
single blocked dev dependency can make a previously-working deploy start failing with
a misleading "Cannot find package X" error for a *different* package that simply
never got installed.

**How to apply:**
- Do not retry the blocked install (the package-management skill says so explicitly).
- Identify the blocked package/version from the 403 line, then remove it with
  `uninstallLanguagePackages` (if it is dev-only / not needed at runtime) or downgrade
  it to a non-flagged version.
- After unblocking, re-run the needed install; npm can then reconcile the tree.
- Leftover npm `scripts` that reference a removed package (e.g. a `test` script for a
  removed test runner) do not affect the build/deploy — they only fail if invoked.
