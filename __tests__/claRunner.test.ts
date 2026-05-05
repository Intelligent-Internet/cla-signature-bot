import { ClaRunner} from "../src/claRunner"
import * as github from '@actions/github';
import { IInputSettings } from "../src/inputSettings"
import { Whitelist } from "../src/claWhitelist";
import { PullAuthors } from "../src/pullAuthors";
import { Author } from "../src/authorMap";
import { ClaFileRepository } from "../src/claFileRepository";
import { PullComments } from "../src/pullComments";
import { SignEvent } from "../src/signEvent";
import { PullCheckRunner } from "../src/pullCheckRunner";
import { SignatureRecord } from "../src/signatureRecord";

const mockGitHub = github.getOctokit("1234567890123456789012345678901234567890");

function getSettings() {
    return {
        octokitLocal: mockGitHub,
        localRepositoryOwner: "owner",
        localRepositoryName: "repo",
        agreementId: "org-cla",
        agreementVersion: "v1",
        pullRequestNumber: 1,
    } as IInputSettings;
}

function getPullAuthorsMock(settings: IInputSettings): [PullAuthors, any] {
    const authors = new PullAuthors(settings);

    const getAuthorsSpy = jest.spyOn(authors, 'getAuthors')
        .mockImplementation(async () => ([
            new Author({
                name: "SomeDude",
                signed: false,
                id: 1234
            }),
            new Author({
                name: "SomeDudette",
                signed: false,
                id: 1235
            }),
            new Author({
                name: "SomeEnby",
                signed: false,
                id: 1236
            })
        ]));

    return [authors, getAuthorsSpy];
}

function getClaFileRepositoryMock(settings: IInputSettings): [ClaFileRepository, any, any, any, any] {
    const fileRepo = new ClaFileRepository(settings);

    const getRepoPolicySpy = jest.spyOn(fileRepo, 'getRepoPolicy')
        .mockImplementation(async () => undefined);

    const getAgreementShaSpy = jest.spyOn(fileRepo, 'getAgreementSha256')
        .mockImplementation(async () => "agreement-hash");

    const mapSignedAuthorsSpy = jest.spyOn(fileRepo, 'mapSignedAuthors')
        .mockImplementation(async (authors) => {
            const { AuthorMap } = await import("../src/authorMap");
            return new AuthorMap(authors.map(a => new Author({
                name: a.name,
                id: a.id,
                email: a.email,
                emailSource: a.emailSource,
                pullRequestNo: a.pullRequestNo,
                signed: false,
            })));
        });

    const writeSignatureSpy = jest.spyOn(fileRepo, 'writeSignature')
        .mockImplementation(async (_record: SignatureRecord) => {});

    return [fileRepo, getRepoPolicySpy, getAgreementShaSpy, mapSignedAuthorsSpy, writeSignatureSpy];
}

function getPullCommentsMock(settings: IInputSettings): [PullComments, any, any]{
    const pullComments = new PullComments(settings);

    const setClaCommentSpy = jest.spyOn(pullComments, 'setClaComment')
        .mockImplementation(async () => (""));

    const getNewSignaturesSpy = jest.spyOn(pullComments, 'getNewSignatures')
        .mockImplementation(async () => ([]));

    return [pullComments, setClaCommentSpy, getNewSignaturesSpy];
}

function getPullCheckRunnerMock(settings: IInputSettings): [PullCheckRunner, any] {
    const pullCheckRunner = new PullCheckRunner(settings);

    const rerunLastCheckSpy = jest.spyOn(pullCheckRunner, 'rerunLastCheck')
        .mockImplementation(async () => {});

        return [pullCheckRunner, rerunLastCheckSpy];
}

afterEach(() => {
    jest.resetAllMocks();
});

it("Successfully constructs with full or empty settings", () => {
    const fullSettings = {
        branch: "master",
        claDocUrl: "",
        isRemoteRepo: true,
        localAccessToken: "",
        octokitLocal: github.getOctokit("1234567890123456789012345678901234567890"),
        octokitRemote: github.getOctokit("1234567890123456789012345678901234567890"),
        payloadAction: "",
        pullRequestNumber: 1,
        repositoryAccessToken: "",
        agreementId: "org-cla",
        agreementVersion: "v1",
        agreementPath: "agreements/org-cla/v1.md",
        repoPolicyPath: "",
        signatureRoot: "signatures",
        localRepositoryName: "name",
        localRepositoryOwner: "owner",
        remoteRepositoryName: "name",
        remoteRepositoryOwner: "owner",
        signatureRegex: /.*/,
        signatureText: "signature",
        whitelist: ""
    } as IInputSettings;

    const runner = new ClaRunner({inputSettings: fullSettings});

    // And constructing with an empty object should also not fail
    const otherRunner = new ClaRunner({inputSettings: {} as IInputSettings});
});

it('Locks the PR when the PR is closed', async () => {
    const lockCommentSpy = jest.spyOn(mockGitHub.issues, 'lock')
        .mockImplementation(async (params) => ({
            url: "",
            data: {},
            status: 200,
            headers: {
                date: "",
                "x-Octokit-media-type": "",
                "x-Octokit-request-id": "",
                "x-ratelimit-limit": "",
                "x-ratelimit-remaining": "",
                "x-ratelimit-reset": "",
                link: "",
                "last-modified": "",
                etag: "",
                status: "200",
            },
            [Symbol.iterator]: () => ({next: () =>  { return { value: null, done: true}}}),
        }));

    const settings = getSettings();
    settings.payloadAction = "closed";
    const runner = new ClaRunner({inputSettings: settings});
    const result = await runner.execute();

    expect(result).toStrictEqual(true);
    expect(lockCommentSpy).toHaveBeenCalledTimes(1);
});

it('Returns early if there are no authors', async () => {
    const settings = getSettings();
    const whitelist = new Whitelist("SomeDude,SomeDudette,SomeEnby");

    const [authors, getAuthorsSpy] = getPullAuthorsMock(settings);

    const runner = new ClaRunner({
        inputSettings: settings,
        claWhitelist: whitelist,
        pullAuthors: authors
        });
    const result = await runner.execute();

    expect(result).toStrictEqual(true);
    expect(getAuthorsSpy).toHaveBeenCalledTimes(1);
});

it ('Fails if not everyone has signed', async () => {
    const settings = getSettings();

    const [authors] = getPullAuthorsMock(settings);
    const [claFileRepo] = getClaFileRepositoryMock(settings);
    const [pullComments, , getNewSignaturesSpy] = getPullCommentsMock(settings);

    const runner = new ClaRunner({
        inputSettings: settings,
        pullAuthors: authors,
        claRepo: claFileRepo,
        pullComments: pullComments,
    });

    const result = await runner.execute();

    expect(result).toStrictEqual(false);
    expect(getNewSignaturesSpy).toHaveBeenCalledTimes(1);
});

it('succeeds if a new signature makes everyone signed', async () => {
    const settings = getSettings();
    settings.whitelist = "SomeDude,SomeDudette";
    settings.pullRequestNumber = 86;

    const [authors] = getPullAuthorsMock(settings);
    const [claFileRepo, , , mapSignedAuthorsSpy, writeSignatureSpy] = getClaFileRepositoryMock(settings);
    mapSignedAuthorsSpy
        .mockImplementationOnce(async (authors: Author[]) => {
            const { AuthorMap } = await import("../src/authorMap");
            return new AuthorMap(authors.map(a => new Author({ name: a.name, id: a.id, signed: false })));
        })
        .mockImplementationOnce(async (authors: Author[]) => {
            const { AuthorMap } = await import("../src/authorMap");
            return new AuthorMap(authors.map(a => new Author({ name: a.name, id: a.id, signed: true })));
        });
    const [pullCheckRunner, rerunLastCheckSpy] = getPullCheckRunnerMock(settings);

    const pullComments = new PullComments(settings);
    const setClaCommentSpy = jest.spyOn(pullComments, 'setClaComment')
        .mockImplementation(async (params) => (""));
    const getNewSignaturesSpy = jest.spyOn(pullComments, 'getNewSignatures')
        .mockImplementation(async (authorMap) => ([
            {
                comment_id: 23,
                created_at: "2026-01-01T00:00:00.000Z",
                id: 1236,
                name: "SomeEnby",
                pullRequestNo: 25,
                repoId: 123456789
            } as SignEvent
        ]));

    const runner = new ClaRunner({
        inputSettings: settings,
        pullAuthors: authors,
        claRepo: claFileRepo,
        pullComments: pullComments,
        pullCheckRunner: pullCheckRunner,
    });

    const result = await runner.execute();
    expect(result).toStrictEqual(true);
    expect(getNewSignaturesSpy).toHaveBeenCalledTimes(1);
    expect(setClaCommentSpy).toHaveBeenCalledTimes(1);
    expect(writeSignatureSpy).toHaveBeenCalledTimes(1);
    expect(rerunLastCheckSpy).toHaveBeenCalledTimes(1);
});

it("filters authors excluded by repository policy", async () => {
    const settings = getSettings();
    const [authors] = getPullAuthorsMock(settings);
    const [claFileRepo, getRepoPolicySpy] = getClaFileRepositoryMock(settings);
    getRepoPolicySpy.mockImplementation(async () => ({
        repo: "owner/repo",
        agreement_id: "org-cla",
        required_version: "v1",
        allow_later_versions: false,
        allow_bot_users: true,
        excluded_github_ids: [1234, 1235, 1236],
    }));
    const [pullComments, setClaCommentSpy, getNewSignaturesSpy] = getPullCommentsMock(settings);

    const runner = new ClaRunner({
        inputSettings: settings,
        pullAuthors: authors,
        claRepo: claFileRepo,
        pullComments,
    });

    const result = await runner.execute();

    expect(result).toStrictEqual(true);
    expect(setClaCommentSpy).toHaveBeenCalledTimes(0);
    expect(getNewSignaturesSpy).toHaveBeenCalledTimes(0);
});
