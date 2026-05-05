import { ClaFileRepository } from "../src/claFileRepository"
import { IInputSettings } from "../src/inputSettings";
import * as github from '@actions/github';
import { Author } from "../src/authorMap";
import { SignatureRecord } from "../src/signatureRecord";

const mockGitHub = github.getOctokit("1234567890123456789012345678901234567890");

const baseSettings = {
    localRepositoryOwner: "some-owner",
    localRepositoryName: "repo-name",
    remoteRepositoryOwner: "cla-owner",
    remoteRepositoryName: "cla-records",
    signatureRoot: "signatures",
    agreementId: "org-cla",
    agreementVersion: "v1",
    agreementPath: "agreements/org-cla/v1.md",
    repoPolicyPath: "repo-policy/some-owner__repo-name.json",
    branch: "main",
    octokitRemote: mockGitHub,
} as IInputSettings;

const signatureRecord = {
    schema_version: 1,
    github_id: 12345,
    github_login_at_signing: "SomeAccount",
    email: "some@example.com",
    email_source: "commit_author_email",
    agreement_id: "org-cla",
    agreement_version: "v1",
    agreement_sha256: "agreement-hash",
    signed_at: "2026-01-01T00:00:00.000Z",
    signed_from_repo: "some-owner/repo-name",
    signed_from_pr: 5,
    signature_method: "github_issue_comment",
    comment_id: 99,
} as SignatureRecord;

function contentResponse(content: unknown, sha = "sha-1") {
    const body = typeof content === "string" ? content : JSON.stringify(content);
    return {
        data: {
            content: Buffer.from(body).toString("base64"),
            sha,
        },
    };
}

beforeEach(() => {
    jest.restoreAllMocks();
});

it("builds signature paths inside the configured namespace only", () => {
    const fileRepo = new ClaFileRepository(baseSettings);
    expect(fileRepo.signaturePath("org-cla", "v1", 12345)).toBe("signatures/org-cla/v1/github-id-12345.json");
    expect(() => fileRepo.signaturePath("../org-cla", "v1", 12345)).toThrow("agreement-id");
    expect(() => fileRepo.signaturePath("org-cla", "v1/../../x", 12345)).toThrow("agreement-version");
    expect(() => fileRepo.signaturePath("org-cla", "v1", -1)).toThrow("github id");
});

it("reads a matching signature record and verifies the agreement hash", async () => {
    const getContentSpy = jest.spyOn(mockGitHub.repos, "getContent")
        .mockImplementation(async () => contentResponse(signatureRecord));
    const fileRepo = new ClaFileRepository(baseSettings);

    await expect(fileRepo.readSignature("org-cla", "v1", 12345)).resolves.toEqual(signatureRecord);
    await expect(fileRepo.signatureExists("org-cla", "v1", 12345, "agreement-hash")).resolves.toBe(true);
    await expect(fileRepo.signatureExists("org-cla", "v1", 12345, "other-hash")).resolves.toBe(false);
    await expect(fileRepo.signatureExists("org-cla", "v1", 99999, "agreement-hash")).resolves.toBe(false);
    expect(getContentSpy).toHaveBeenCalledTimes(4);
});

it("returns undefined for missing signatures", async () => {
    jest.spyOn(mockGitHub.repos, "getContent").mockImplementation(async () => { throw { status: 404 }; });
    const fileRepo = new ClaFileRepository(baseSettings);

    await expect(fileRepo.readSignature("org-cla", "v1", 12345)).resolves.toBeUndefined();
});

it("writes signature records and refuses readonly repositories", async () => {
    const getContentSpy = jest.spyOn(mockGitHub.repos, "getContent").mockImplementation(async () => { throw { status: 404 }; });
    const createSpy = jest.spyOn(mockGitHub.repos, "createOrUpdateFileContents").mockImplementation(async () => ({ data: {} }));
    const fileRepo = new ClaFileRepository({ ...baseSettings, isRemoteRepoReadonly: false } as IInputSettings);

    await fileRepo.writeSignature(signatureRecord);
    expect(getContentSpy).toHaveBeenCalledWith(expect.objectContaining({
        path: "signatures/org-cla/v1/github-id-12345.json",
    }));
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        path: "signatures/org-cla/v1/github-id-12345.json",
        branch: "main",
    }));

    const readonlyRepo = new ClaFileRepository({ ...baseSettings, isRemoteRepoReadonly: true } as IInputSettings);
    await expect(readonlyRepo.writeSignature(signatureRecord)).rejects.toThrow("private signature repository");
});

it("hashes the agreement text and fails closed without agreement-path", async () => {
    jest.spyOn(mockGitHub.repos, "getContent").mockImplementation(async () => contentResponse("hello cla"));
    const fileRepo = new ClaFileRepository(baseSettings);

    await expect(fileRepo.getAgreementSha256()).resolves.toBe("fe65eb46385a73950d35a3c80bb9e7b9fe58743ac2ce40c764d11d2be40a8abc");

    const missingAgreementPathRepo = new ClaFileRepository({ ...baseSettings, agreementPath: "" } as IInputSettings);
    await expect(missingAgreementPathRepo.getAgreementSha256()).rejects.toThrow("agreement-path is required");
});

it("maps signed authors using agreement hash binding", async () => {
    const getContentSpy = jest.spyOn(mockGitHub.repos, "getContent")
        .mockImplementation(async (params) => {
            if (params.path === "agreements/org-cla/v1.md") {
                return contentResponse("hello cla");
            }
            if (params.path === "signatures/org-cla/v1/github-id-12345.json") {
                return contentResponse({
                    ...signatureRecord,
                    agreement_sha256: "fe65eb46385a73950d35a3c80bb9e7b9fe58743ac2ce40c764d11d2be40a8abc",
                });
            }
            throw { status: 404 };
        });
    const fileRepo = new ClaFileRepository(baseSettings);
    const authorMap = await fileRepo.mapSignedAuthors([
        new Author({ name: "SomeAccount", id: 12345, signed: false }),
        new Author({ name: "OtherAccount", id: 999, signed: false }),
    ]);

    expect(authorMap.getSigned().map(a => a.name)).toEqual(["SomeAccount"]);
    expect(authorMap.getUnsigned().map(a => a.name)).toEqual(["OtherAccount"]);
    expect(getContentSpy).toHaveBeenCalledTimes(3);
});

it("reads and validates repository policy without exposing policy contents", async () => {
    jest.spyOn(mockGitHub.repos, "getContent").mockImplementation(async () => contentResponse({
        repo: "some-owner/repo-name",
        agreement_id: "org-cla",
        required_version: "v1",
        allow_later_versions: false,
        excluded_github_ids: [12345],
    }));
    const fileRepo = new ClaFileRepository(baseSettings);

    await expect(fileRepo.getRepoPolicy()).resolves.toEqual({
        repo: "some-owner/repo-name",
        agreement_id: "org-cla",
        required_version: "v1",
        allow_later_versions: false,
        allow_bot_users: true,
        excluded_github_ids: [12345],
    });
});

it("rejects unsupported or mismatched repository policy", async () => {
    jest.spyOn(mockGitHub.repos, "getContent").mockImplementation(async () => contentResponse({
        repo: "some-owner/repo-name",
        agreement_id: "org-cla",
        required_version: "v1",
        allow_later_versions: true,
    }));
    const fileRepo = new ClaFileRepository(baseSettings);

    await expect(fileRepo.getRepoPolicy()).rejects.toThrow("allow_later_versions=true");
});
