import * as core from "@actions/core";
import * as github from '@actions/github';
import { context } from "@actions/github";
import { IInputSettings } from "./inputSettings";
import { parseRepositoryName, validateBranch, validateIdentifier, validateRelativePath } from "./inputValidator";

export function getInputs(): IInputSettings {
    const settings = {} as IInputSettings;

    // Standard context details dumped into an easy-to-read object.
    settings.pullRequestNumber = context.issue.number;
    settings.payloadAction = context.payload.action;
    settings.workflowName = context.workflow;
    settings.localAccessToken = process.env["GITHUB_TOKEN"] as string;
    settings.workflowRunId = Number(process.env["GITHUB_RUN_ID"]) || undefined;

    settings.isRemoteRepo = true;
    const required = { required: true } as core.InputOptions;

    // The repo name should be owner/repo-name and needs to be split to be used.
    [settings.remoteRepositoryOwner, settings.remoteRepositoryName] = parseRepositoryName(
        core.getInput("signature-repo", required));

    const remoteRepoPat = process.env["CLA_RECORDS_TOKEN"] || core.getInput("signature-repo-token") || core.getInput("remote-repo-pat");
    if (!remoteRepoPat) {
        throw new Error("A private signature repository token is required. Set CLA_RECORDS_TOKEN or signature-repo-token.");
    }
    settings.isRemoteRepoReadonly = false;
    settings.repositoryAccessToken = remoteRepoPat;

    settings.localRepositoryOwner = context.repo.owner;
    settings.localRepositoryName = context.repo.repo;

    settings.signatureRoot = validateRelativePath("signature-root", core.getInput("signature-root") || "signatures", { required: true });
    settings.agreementId = validateIdentifier("agreement-id", core.getInput("agreement-id", required));
    settings.agreementVersion = validateIdentifier("agreement-version", core.getInput("agreement-version", required));
    settings.agreementPath = validateRelativePath("agreement-path", core.getInput("agreement-path", required), { required: true });
    settings.repoPolicyPath = validateRelativePath("repo-policy-path", core.getInput("repo-policy-path") || "");
    settings.branch = validateBranch(core.getInput("branch") || "master");
    settings.whitelist = core.getInput("whitelist") || "";

    settings.signatureText = core.getInput("signature-text") || "I have read the CLA Document and I hereby sign the CLA";
    settings.signatureRegex = new RegExp(core.getInput("signature-regex") || /^.*I\s*HAVE\s*READ\s*THE\s*CLA\s*DOCUMENT\s*AND\s*I\s*HEREBY\s*SIGN\s*THE\s*CLA/);

    if (!settings.signatureText.toUpperCase().match(settings.signatureRegex)) {
        throw new Error("Signature RegEx does not match against Signature Text. Confirm valid RegEx.");
    }

    settings.claDocUrl = core.getInput('url-to-cladocument') || settings.agreementPath || `${settings.agreementId}/${settings.agreementVersion}`;

    settings.octokitLocal = github.getOctokit(settings.localAccessToken);
    settings.octokitRemote = github.getOctokit(settings.repositoryAccessToken);

    writeOutSettings(settings);

    return settings;
}

function writeOutSettings(settings: IInputSettings) {
    core.debug("All input settings constructed:");
    for (var prop in settings) {
        if (shouldRedactSetting(prop)) {
            core.debug(`${prop}: [redacted]`);
            continue;
        }
        core.debug(`${prop}: ${settings[prop]}`);
    }
}

function shouldRedactSetting(prop: string): boolean {
    const normalized = prop.toLowerCase();
    return normalized.includes("token")
        || normalized.includes("octokit")
        || normalized === "remoterepositoryowner"
        || normalized === "remoterepositoryname"
        || normalized === "repositoryaccesstoken";
}
