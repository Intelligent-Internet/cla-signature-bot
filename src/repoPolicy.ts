export interface RepoPolicy {
    repo: string;
    agreement_id: string;
    required_version: string;
    allow_later_versions?: boolean;
    allow_bot_users?: boolean;
    excluded_github_ids?: number[];
}

export function validateRepoPolicy(raw: unknown, expected: {
    repo: string;
    agreementId: string;
    agreementVersion: string;
}): RepoPolicy {
    if (!raw || typeof raw !== "object") {
        throw new Error("Repository policy must be a JSON object.");
    }

    const policy = raw as RepoPolicy;
    if (policy.repo !== expected.repo) {
        throw new Error("Repository policy repo does not match the current repository.");
    }
    if (policy.agreement_id !== expected.agreementId) {
        throw new Error("Repository policy agreement_id does not match the configured agreement-id.");
    }
    if (policy.required_version !== expected.agreementVersion) {
        throw new Error("Repository policy required_version does not match the configured agreement-version.");
    }
    if (policy.allow_later_versions === true) {
        throw new Error("Repository policy allow_later_versions=true is not supported yet.");
    }
    if (policy.allow_bot_users === false) {
        throw new Error("Repository policy allow_bot_users=false is not supported yet.");
    }
    if (policy.excluded_github_ids !== undefined) {
        if (!Array.isArray(policy.excluded_github_ids) || policy.excluded_github_ids.some(id => !Number.isInteger(id) || id <= 0)) {
            throw new Error("Repository policy excluded_github_ids must be an array of positive integer GitHub ids.");
        }
    }

    return {
        repo: policy.repo,
        agreement_id: policy.agreement_id,
        required_version: policy.required_version,
        allow_later_versions: false,
        allow_bot_users: true,
        excluded_github_ids: policy.excluded_github_ids || [],
    };
}
