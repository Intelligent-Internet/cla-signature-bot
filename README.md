# Contributor License Agreement Signature GitHub Action

![build](https://github.com/Roblox/cla-assistant/workflows/build/badge.svg?branch=master)

A GitHub Action for GitHub-native automated handling of contributor license agreement signatures. This action enables developers to self-sign a CLA without having to run external services for a separate system. The Action stores signatures in a required private signature records repository.

## Features

1. Centralized private signature storage.
1. Fully integrated GitHub Action, no external services required.
1. No dedicated UI, simply uses comments in Pull Requests.
1. Contributors can sign the CLA by just posting a Pull Request comment.
1. Signatures will be stored in a file for auditing.

Signatures are stored in one JSON file per signer in the private signature repository.

![Screenshot 2020-01-07 at 16 13 43](https://user-images.githubusercontent.com/33329946/71905595-c33aec80-3168-11ea-8a08-c78f13cb0dcb.png)

## Configure CLA Signature Action in two minutes

### Add the following Workflow File to your repository in the path `.github/workflows/cla.yml`

```yml
name: "CLA Signature Bot"
on:
  issue_comment:
    types: [created]
  pull_request:
    types: [opened,closed,synchronize]

jobs:
  CLABot:
    runs-on: ubuntu-latest
    steps:
      - name: "CLA Signature Bot"
        uses: roblox/cla-assistant@2.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CLA_RECORDS_TOKEN: ${{ secrets.CLA_RECORDS_TOKEN }}
        with:
          signature-repo: your-org/cla-records-private
          agreement-id: your-org-cla
          agreement-version: v1
          agreement-path: agreements/your-org-cla/v1.md
          signature-root: signatures
          url-to-cladocument: 'https://link/to/your/legal/CLA/document/of/choice'
          # This branch can't have protections, commits are made directly to the specified branch.
          branch: 'main'
          whitelist: githubuser_example,anotherGitHubuser,bot

```

### Open a new pull request

CLA action workflow will be triggered on all Pull Request `opened, synchronize, closed`.

When the CLA workflow is triggered on pull request `closed` event, it will lock the Pull Request conversation after the Pull Request merge so that the contributors cannot modify or delete the signature comments later.

If your signature is not on file and your account isn't in the whitelist, the CLA Bot will provide instructions on what to do in the PR Conversation and block the PR from merging until all authors of commits sign the CLA.

![Screenshot 2020-02-13 at 10 24 17](https://user-images.githubusercontent.com/33329946/74420003-0ca6e780-4e4b-11ea-85a7-4ccc3f53e3d5.png)

### Sign the CLA

The CLA Signature Action will comment on the pull request asking for authors to sign the CLA. Commit authors will then need to use their GitHub accounts to write **"I have read the CLA Document and I hereby sign the CLA"** in the Pull Request comments to sign the CLA.

Add a comment with the requested signature to your pull request to sign the CLA. The action will execute again and automatically mark your signature in the CLA signatures file. When all authors have signed the CLA the PR check will pass.

## Additional Configuration Options

### Whitelist Accounts

The `whitelist` parameter is a comma-seprated list of accounts which should not be considered for CLA signature verification. These accounts will **completely bypass the signature process**, and if all authors are whitelisted in a PR the CLA Signature Action won't even comment on the PR.

This feature is particularly useful for other bot accounts, such as dependabot or greenkeeper. For example, `dependabot-preview[bot],greenkeeper[bot]` will whitelist both of those bot accounts.

Wildcards are accepted and will be treated as a regex .* character, so you can whitelist ranges of accounts. Use caution with wildcards to avoid whitelisting actual human contributors.

Some common accounts you may want to whitelist:

* `dependabot[bot]` - This is the account GitHub will use to open Dependabot fixes on your account.
* Your personal account - Since you'll be opening the PR to add it you'll need to either sign the CLA or just add yourself to the whitelist.

### Blockchain storage

Blockchain storage and webhook forwarding are removed and unsupported. Signature events are not posted to external webhooks.

### Full list of configuration options

#### Environment Variables (env: yaml section)

| Name                  | Requirement | Description |
| --------------------- | ----------- | ----------- |
| `GITHUB_TOKEN`        | _Required_ | Used for interacting with the local repository, such as adding comments to PRs. Does not need to be manually specified in Repository Secrets, [read more](https://help.github.com/en/actions/configuring-and-managing-workflows/authenticating-with-the-github_token). Must be in the form of `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` |
| `CLA_RECORDS_TOKEN`   | _Required_ | Token with read/write access to the private signature records repository. |

#### Inputs (with: yaml section)

| Name                          | Requirement | Description |
| ----------------------------- | ----------- | ----------- |
| `signature-repo`              | _Required_  | Private `owner/repo` where CLA agreements, policy files, and signature JSON records are stored. |
| `agreement-id`                | _Required_  | Organization-level CLA agreement identifier. Must be a safe path segment. |
| `agreement-version`           | _Required_  | Required agreement version. Must be a safe path segment. |
| `agreement-path`              | _Required_  | Path to the CLA text in the private signature repo. Signature records are bound to this file's SHA-256 hash. |
| `signature-repo-token`        | _optional_  | Token with read/write access to `signature-repo`. Prefer `CLA_RECORDS_TOKEN`. |
| `signature-root`              | _optional_  | Root directory in the private signature repo for per-user signature records. Default is `signatures`. |
| `repo-policy-path`            | _optional_  | Path to a private JSON policy file. When set, `repo`, `agreement_id`, and `required_version` must match exactly; `allow_later_versions` must be `false`; `excluded_github_ids` are excluded from author checks. |
| `url-to-cladocument`          | _optional_  | The URL of your CLA document shown in the PR comment. Defaults to the configured agreement path. |
| `branch`                      | _optional_  | Repository branch to store the signature file. Default is `master` |
| `whitelist`                   | _optional_  | Comma-separated list of accounts to [ignore](https://github.com/roblox/cla-assistant#Whitelist-Accounts). Example: `user1,user2,bot*` |
| `remote-repo-pat`             | _optional_  | Deprecated compatibility token input. Prefer `CLA_RECORDS_TOKEN` or `signature-repo-token`. |

## License

Contributor License Agreement Signature Bot Copyright (c) 2020 [Roblox Corporation](https://roblox.com). All rights reserved.

[Licensed under the Apache License, Version 2.0.](./LICENSE)

## Credits

Provided with ♥ by Roblox.

This project is an extension of the original CLA-Assistant-Lite project created by [SAP SE](http://www.sap.com) and especially [Akshay Iyyadurai Balasundaram
](https://github.com/ibakshay). Our thanks go out to them for the idea and initial implementation that was rewritten into this system. The original project can be found at [https://github.com/cla-assistant/github-action](https://github.com/cla-assistant/github-action).
