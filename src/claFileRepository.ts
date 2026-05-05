import * as core from '@actions/core';
import { createHash } from "crypto";
import { Author, AuthorMap } from "./authorMap";
import { assertPathWithinNamespace, validateIdentifier, validateRelativePath } from "./inputValidator";
import { IInputSettings } from "./inputSettings";
import { repos } from "./octokitCompat";
import { RepoPolicy, validateRepoPolicy } from "./repoPolicy";
import { SignatureRecord } from "./signatureRecord";

export class ClaFileRepository {
    readonly settings: IInputSettings;
    private _agreementSha256?: string;

    constructor(settings: IInputSettings) {
        this.settings = settings;
    }

    public signaturePath(agreementId: string, version: string, githubId: number): string {
        const signatureRoot = validateRelativePath("signature-root", this.settings.signatureRoot, { required: true });
        const safeAgreementId = validateIdentifier("agreement-id", agreementId);
        const safeVersion = validateIdentifier("agreement-version", version);
        if (!Number.isInteger(githubId) || githubId <= 0) {
            throw new Error("github id must be a positive integer.");
        }

        const path = [
            signatureRoot,
            safeAgreementId,
            safeVersion,
            `github-id-${githubId}.json`
        ].filter(Boolean).join("/");
        assertPathWithinNamespace(signatureRoot, path);
        return path;
    }

    public async readSignature(agreementId: string, version: string, githubId: number): Promise<SignatureRecord | undefined> {
        try {
            const fileResult = await repos(this.settings.octokitRemote).getContent({
                owner: this.settings.remoteRepositoryOwner,
                repo: this.settings.remoteRepositoryName,
                path: this.signaturePath(agreementId, version, githubId),
                ref: this.settings.branch,
            });

            if (Array.isArray(fileResult.data) || !("content" in fileResult.data)) {
                throw new Error("Signature path resolved to a directory instead of a JSON file.");
            }

            return JSON.parse(Buffer.from(fileResult.data.content, "base64").toString("utf8")) as SignatureRecord;
        } catch (error: any) {
            if (error.status === 404) {
                return undefined;
            }

            throw new Error(`Failed to get signature record: ${error.message}. Details: ${JSON.stringify(error.stack)}`);
        }
    }

    public async writeSignature(signatureRecord: SignatureRecord): Promise<void> {
        if (this.settings.isRemoteRepoReadonly) {
            throw new Error("Cannot write to the private signature repository because no CLA_RECORDS_TOKEN, signature-repo-token, or remote-repo-pat was provided.");
        }

        const path = this.signaturePath(
            signatureRecord.agreement_id,
            signatureRecord.agreement_version,
            signatureRecord.github_id
        );
        const existing = await this.getContentSha(path);

        await repos(this.settings.octokitRemote).createOrUpdateFileContents({
            owner: this.settings.remoteRepositoryOwner,
            repo: this.settings.remoteRepositoryName,
            path,
            branch: this.settings.branch,
            message: `Add CLA signature for github-id-${signatureRecord.github_id}`,
            content: Buffer.from(JSON.stringify(signatureRecord, null, 2)).toString("base64"),
            sha: existing,
        });
    }

    public async signatureExists(
        agreementId: string,
        version: string,
        githubId: number,
        agreementSha256?: string
    ): Promise<boolean> {
        const record = await this.readSignature(agreementId, version, githubId);
        if (!record) {
            return false;
        }

        return record.github_id === githubId
            && record.agreement_id === agreementId
            && record.agreement_version === version
            && (!agreementSha256 || record.agreement_sha256 === agreementSha256);
    }

    public async mapSignedAuthors(authors: Author[]): Promise<AuthorMap> {
        const agreementSha256 = await this.getAgreementSha256();
        const mapped = await Promise.all(authors.map(async a =>
            new Author({
                name: a.name,
                id: a.id,
                email: a.email,
                emailSource: a.emailSource,
                pullRequestNo: a.pullRequestNo,
                signed: !!a.id && await this.signatureExists(
                    this.settings.agreementId,
                    this.settings.agreementVersion,
                    a.id,
                    agreementSha256
                )
            })
        ));

        return new AuthorMap(mapped);
    }

    public async getAgreementSha256(): Promise<string> {
        if (this._agreementSha256 !== undefined) {
            return this._agreementSha256;
        }

        if (!this.settings.agreementPath) {
            throw new Error("agreement-path is required for CLA text hash binding.");
        }

        try {
            const fileResult = await repos(this.settings.octokitRemote).getContent({
                owner: this.settings.remoteRepositoryOwner,
                repo: this.settings.remoteRepositoryName,
                path: this.settings.agreementPath,
                ref: this.settings.branch,
            });

            if (Array.isArray(fileResult.data) || !("content" in fileResult.data)) {
                throw new Error("Agreement path resolved to a directory instead of a file.");
            }

            const agreementText = Buffer.from(fileResult.data.content, "base64").toString("utf8");
            this._agreementSha256 = createHash("sha256").update(agreementText, "utf8").digest("hex");
            return this._agreementSha256;
        } catch (error: any) {
            throw new Error(`Failed to get agreement text for hashing: ${error.message}. Details: ${JSON.stringify(error.stack)}`);
        }
    }

    public async getRepoPolicy(): Promise<RepoPolicy | undefined> {
        if (!this.settings.repoPolicyPath) {
            return undefined;
        }

        try {
            const fileResult = await repos(this.settings.octokitRemote).getContent({
                owner: this.settings.remoteRepositoryOwner,
                repo: this.settings.remoteRepositoryName,
                path: this.settings.repoPolicyPath,
                ref: this.settings.branch,
            });

            if (Array.isArray(fileResult.data) || !("content" in fileResult.data)) {
                throw new Error("Repository policy path resolved to a directory instead of a JSON file.");
            }

            const policy = JSON.parse(Buffer.from(fileResult.data.content, "base64").toString("utf8"));
            return validateRepoPolicy(policy, {
                repo: `${this.settings.localRepositoryOwner}/${this.settings.localRepositoryName}`,
                agreementId: this.settings.agreementId,
                agreementVersion: this.settings.agreementVersion,
            });
        } catch (error: any) {
            throw new Error(`Failed to read or validate repository policy: ${error.message}.`);
        }
    }

    private async getContentSha(path: string): Promise<string | undefined> {
        try {
            const fileResult = await repos(this.settings.octokitRemote).getContent({
                owner: this.settings.remoteRepositoryOwner,
                repo: this.settings.remoteRepositoryName,
                path,
                ref: this.settings.branch,
            });

            if (Array.isArray(fileResult.data)) {
                throw new Error("Signature path resolved to a directory instead of a JSON file.");
            }

            return fileResult.data.sha;
        } catch (error: any) {
            if (error.status === 404) {
                return undefined;
            }

            throw error;
        }
    }
}
