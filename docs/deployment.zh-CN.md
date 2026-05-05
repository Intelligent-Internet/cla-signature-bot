# 部署指南

本文档说明如何部署 fork 后的 CLA Signature Action，实现组织级 CLA 和私有签名记录仓库。

## 1. 准备私有记录仓库

1. 创建一个 private repo，例如 `your-org/cla-records-private`。
2. 添加 CLA 文本：

```text
agreements/your-org-cla/v1.md
```

3. 可选：添加每个 public repo 的 policy 文件：

```text
repo-policy/your-org__public-repo-a.json
```

policy 示例：

```json
{
  "repo": "your-org/public-repo-a",
  "agreement_id": "your-org-cla",
  "required_version": "v1",
  "allow_later_versions": false,
  "allow_bot_users": true,
  "excluded_github_ids": []
}
```

配置 `repo-policy-path` 后，Action 会从 private records repo 读取这份 JSON，并校验 `repo`、`agreement_id`、`required_version` 必须分别匹配当前仓库和 workflow 输入，否则 fail closed。当前 `allow_later_versions` 只支持 `false`；later version 匹配尚不支持。`excluded_github_ids` 会在 CLA 检查前把这些 GitHub user id 从作者集合中排除。Policy 文件内容不会打印到公开评论或日志。

4. 初始化签名根目录：

```text
signatures/.gitkeep
```

Action 会为每个签署者写入单独的 JSON 文件：

```text
signatures/your-org-cla/v1/github-id-123456.json
```

## 2. 创建访问 Token

推荐使用 GitHub App，并授予最小权限。

对 public repo：

```text
Pull requests: read
Issues: write
Checks: write
Commit statuses: write
Contents: read
Metadata: read
```

对 `your-org/cla-records-private`：

```text
Contents: read/write
Metadata: read
```

如果暂时不使用 GitHub App，可以创建 fine-grained PAT，只授权 `your-org/cla-records-private`，权限为 `Contents: read/write` 和 `Metadata: read`。

把 token 保存为 organization secret 或 repository secret：

```text
CLA_RECORDS_TOKEN
```

## 3. 发布 Action

1. 在本仓库执行验证：

```bash
npm ci
npm audit
npm run build
npm run dist
```

2. 提交生成后的 `dist/`。
3. 打 tag：

```bash
git tag v1
git push origin v1
```

生产环境 workflow 建议 pin 到 commit SHA，而不是长期使用浮动 tag。

## 4. 在每个 Public Repo 添加 Workflow

创建 `.github/workflows/cla.yml`：

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

安全注意：使用 `pull_request_target` 时，不要 checkout 或执行 fork PR 中的代码。本 Action 只读取 PR metadata、commits 和 comments。

必填输入说明：`signature-repo`、`agreement-id`、`agreement-version`、`agreement-path` 都是必填项。Action 还要求为 private signature repo 提供 `CLA_RECORDS_TOKEN` 或 `signature-repo-token`；`remote-repo-pat` 仅作为旧 workflow 兼容入口保留。缺少 `agreement-path` 会报错，因为签名记录必须绑定到 CLA 文本的 SHA-256 hash。

Blockchain 说明：blockchain storage 和 webhook forwarding 已移除且不支持。签名事件，包括只写入 private record 的 contributor email metadata，不会发送到外部 blockchain webhook。

## 5. 配置 Branch Protection

在每个 public repo 的受保护分支上：

1. 启用 `Require status checks to pass before merging`。
2. 选择 CLA workflow/check 作为 required check。
3. 如果符合仓库策略，启用 `Require branches to be up to date before merging`。
4. 只允许可信 maintainer 绕过限制。

## 6. 端到端验证

1. 用未签署 CLA 的 contributor 开 PR。
2. 确认 CLA check 失败，并且公开评论只显示 GitHub username。
3. 在 PR 下评论：

```text
I have read the CLA Document and I hereby sign the CLA
```

4. 确认 private repo 里生成签名 JSON：

```text
signatures/your-org-cla/v1/github-id-<github_id>.json
```

5. 等待或重新运行 CLA check，确认通过。
6. 同一个 contributor 在另一个使用相同 `agreement-id` 和 `agreement-version` 的 public repo 中开 PR，应无需再次签署即可通过。
