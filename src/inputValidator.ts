const SAFE_REPO_PART = /^[A-Za-z0-9_.-]+$/;
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SAFE_BRANCH = /^[A-Za-z0-9._/-]+$/;

export function parseRepositoryName(rawRepoName: string): [string, string] {
    const repo = requireNonEmpty("signature-repo", rawRepoName);
    const split = repo.split("/");
    if (split.length !== 2 || !split[0] || !split[1]) {
        throw new Error(`Unable to parse repository name ${rawRepoName} into owner/repo-name format. Make sure the signature-repo input is set correctly.`);
    }

    for (const part of split) {
        if (!SAFE_REPO_PART.test(part) || containsEncodedTraversal(part)) {
            throw new Error(`Invalid repository name ${rawRepoName}. Owner and repo may only contain letters, numbers, '.', '_' and '-'.`);
        }
    }

    return split as [string, string];
}

export function validateIdentifier(name: string, value: string): string {
    const candidate = requireNonEmpty(name, value);
    const decoded = decodeRepeated(candidate, name);
    if (candidate.includes("/") || candidate.includes("\\") || decoded.includes("/") || decoded.includes("\\")) {
        throw new Error(`${name} must be a single path segment and cannot contain slashes.`);
    }
    if (candidate === "." || candidate === ".." || decoded === "." || decoded === ".." || candidate.includes("..") || decoded.includes("..")) {
        throw new Error(`${name} cannot contain traversal segments.`);
    }
    if (!SAFE_PATH_SEGMENT.test(candidate) || !SAFE_PATH_SEGMENT.test(decoded)) {
        throw new Error(`${name} may only contain letters, numbers, '.', '_' and '-'.`);
    }
    return candidate;
}

export function validateRelativePath(name: string, value: string, options: { required?: boolean } = {}): string {
    if (!value) {
        if (options.required) {
            throw new Error(`${name} is required.`);
        }
        return "";
    }

    const candidate = value.trim();
    const decoded = decodeRepeated(candidate, name);
    if (!candidate || !decoded) {
        if (options.required) {
            throw new Error(`${name} is required.`);
        }
        return "";
    }

    for (const current of [candidate, decoded]) {
        if (current.startsWith("/") || current.includes("\\") || current.includes("//")) {
            throw new Error(`${name} must be a relative repository path.`);
        }
        const segments = current.split("/");
        if (segments.some(segment => !segment || segment === "." || segment === ".." || segment.includes(".."))) {
            throw new Error(`${name} cannot contain empty or traversal path segments.`);
        }
        if (segments.some(segment => !SAFE_PATH_SEGMENT.test(segment))) {
            throw new Error(`${name} path segments may only contain letters, numbers, '.', '_' and '-'.`);
        }
    }

    return candidate;
}

export function validateBranch(value: string): string {
    const branch = requireNonEmpty("branch", value);
    const decoded = decodeRepeated(branch, "branch");
    for (const current of [branch, decoded]) {
        if (
            current.startsWith("/") ||
            current.endsWith("/") ||
            current.includes("\\") ||
            current.includes("//") ||
            current.includes("..") ||
            current.includes("@{") ||
            current.endsWith(".lock") ||
            current === "." ||
            !SAFE_BRANCH.test(current)
        ) {
            throw new Error("branch contains unsafe characters or traversal syntax.");
        }
    }
    return branch;
}

export function assertPathWithinNamespace(namespace: string, path: string): void {
    if (path !== namespace && !path.startsWith(`${namespace}/`)) {
        throw new Error("Signature path escaped the configured signature namespace.");
    }
}

function requireNonEmpty(name: string, value: string): string {
    if (!value || !value.trim()) {
        throw new Error(`${name} is required.`);
    }
    return value.trim();
}

function containsEncodedTraversal(value: string): boolean {
    const decoded = decodeRepeated(value, "repository");
    return decoded.includes("/") || decoded.includes("\\") || decoded.includes("..");
}

function decodeRepeated(value: string, name: string): string {
    let current = value;
    for (let i = 0; i < 5; i++) {
        let decoded: string;
        try {
            decoded = decodeURIComponent(current);
        } catch {
            throw new Error(`${name} contains invalid URL encoding.`);
        }
        if (decoded === current) {
            return decoded;
        }
        current = decoded;
    }
    return current;
}
