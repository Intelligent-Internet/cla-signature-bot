# Deployment Guide

This guide deploys the forked CLA Signature Action with an organization-level CLA and a private signature records repository.

## 1. Prepare the Private Records Repository

1. Create a private repository, for example `your-org/cla-records-private`.
2. Add the CLA text:

```text
agreements/your-org-cla/v1.md
```

3. Add optional repository policy files:

```text
repo-policy/your-org__public-repo-a.json
```

Example policy:

```json
{
  "repo": "your-org/public-repo-a",
  "agreement_id": "your-org-cla",
  "required_version": "v1",
  "allow_later_versions": false,
  "public_display_fields": ["github_login"],
  "require_all_commit_authors": true,
  "allow_bot_users": true,
  "excluded_github_ids": []
}
```

4. Create the signature root directory when you initialize the repo:

```text
signatures/.gitkeep
```

The action writes one JSON file per signer:

```text
signatures/your-org-cla/v1/github-id-123456.json
```

## 2. Create the Access Token

Recommended: create a GitHub App with minimum permissions.

For the public repositories:

```text
Pull requests: read
Issues: write
Checks: write
Commit statuses: write
Contents: read
Metadata: read
```

For `your-org/cla-records-private`:

```text
Contents: read/write
Metadata: read
```

If you are not ready to use a GitHub App, create a fine-grained PAT limited to `your-org/cla-records-private` with `Contents: read/write` and `Metadata: read`.

Store the token as an organization or repository secret:

```text
CLA_RECORDS_TOKEN
```

## 3. Publish the Action

1. Run validation in this repository:

```bash
npm ci
npm audit
npm run build
npm run dist
```

2. Commit the generated `dist/` output.
3. Tag the release:

```bash
git tag v1
git push origin v1
```

For production workflows, pin to a commit SHA instead of a floating tag when possible.

## 4. Add the Workflow to Each Public Repository

Create `.github/workflows/cla.yml`:

```yaml
name: CLA

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: read
  issues: write
  checks: write
  statuses: write
  actions: write

jobs:
  cla:
    runs-on: ubuntu-latest
    steps:
      - name: Check CLA
        uses: your-org/cla-signature-bot@v1
        with:
          signature-repo: your-org/cla-records-private
          signature-root: signatures
          agreement-id: your-org-cla
          agreement-version: v1
          agreement-path: agreements/your-org-cla/v1.md
          repo-policy-path: repo-policy/your-org__public-repo-a.json
          branch: main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CLA_RECORDS_TOKEN: ${{ secrets.CLA_RECORDS_TOKEN }}
```

Security note: `pull_request_target` must not checkout or execute code from fork pull requests. This action only reads PR metadata, commits, and comments.

## 5. Configure Branch Protection

On every protected branch in each public repository:

1. Enable `Require status checks to pass before merging`.
2. Select the CLA workflow/check as required.
3. Enable `Require branches to be up to date before merging` if that matches your repository policy.
4. Restrict bypass rights to trusted maintainers only.

## 6. Validate End to End

1. Open a PR from a contributor without a signature.
2. Confirm the CLA check fails and the public comment shows only GitHub usernames.
3. Comment with:

```text
I have read the CLA Document and I hereby sign the CLA
```

4. Confirm a private JSON record is created under:

```text
signatures/your-org-cla/v1/github-id-<github_id>.json
```

5. Re-run or wait for the CLA check to pass.
6. Open a PR from the same contributor in another public repository using the same `agreement-id` and `agreement-version`; it should pass without another signature.
