import * as github from '@actions/github'
import * as core from '@actions/core'
import * as inputHelper from '../src/inputHelper'
import { IInputSettings } from '../src/inputSettings'

let inputs = {} as any
let originalToken: string | undefined;
jest.spyOn(core, 'debug').mockImplementation(() => {});

const ref = 'refs/pull/232/merge';
const sha = '1234567890123456789012345678901234567890';

beforeAll(() => {
    originalToken = process.env["CLA_RECORDS_TOKEN"];
    process.env["GITHUB_TOKEN"] = "1234567890098765432112345678900987654321";
    jest.spyOn(core, 'getInput').mockImplementation((name: string, options?: core.InputOptions) => {
        const val: string = inputs[name];
        if (options && options.required && !val) {
            throw new Error(`Input required and not supplied: ${name}`);
        };
        return val || "";
    })

    github.context.repo = {
        owner: 'some-owner',
        repo: 'some-repo'
    };
    github.context.ref = ref;
    github.context.sha = sha;
});

beforeEach(() => {
    inputs = {
        "signature-repo": "cla-org/cla-records",
        "agreement-id": "org-cla",
        "agreement-version": "v1",
        "agreement-path": "agreements/org-cla/v1.md",
    };
    process.env["CLA_RECORDS_TOKEN"] = "1234567890123456789012345678901234567890";
})

afterAll(() => {
    if (originalToken === undefined) {
        delete process.env["CLA_RECORDS_TOKEN"];
    } else {
        process.env["CLA_RECORDS_TOKEN"] = originalToken;
    }
    jest.restoreAllMocks();
})

it('sets fail-closed defaults around required private signature repo inputs', () => {
    inputs["url-to-cladocument"] = "some/path/to/a/doc.md";
    const settings: IInputSettings = inputHelper.getInputs();
    expect(settings).toBeTruthy();
    expect(settings.branch).toBe('master');
    expect(settings.claDocUrl).toBe('some/path/to/a/doc.md');
    expect(settings.remoteRepositoryName).toBe("cla-records");
    expect(settings.remoteRepositoryOwner).toBe("cla-org");
    expect(settings.localRepositoryName).toBe("some-repo");
    expect(settings.localRepositoryOwner).toBe("some-owner");
    expect(settings.repositoryAccessToken).toBe(process.env["CLA_RECORDS_TOKEN"]);
    expect(settings.isRemoteRepo).toBe(true);
    expect(settings.isRemoteRepoReadonly).toBe(false);
    expect(settings.signatureRoot).toBe("signatures");
    expect(settings.agreementId).toBe("org-cla");
    expect(settings.agreementVersion).toBe("v1");
    expect(settings.agreementPath).toBe("agreements/org-cla/v1.md");
    expect(settings.whitelist).toBeFalsy();
    expect(settings.octokitRemote).toBeTruthy();
    expect(settings.octokitLocal).toBeTruthy();
    const debugOutput = (core.debug as jest.Mock).mock.calls.map(call => String(call[0])).join("\n");
    expect(debugOutput).not.toContain("cla-records");
    expect(debugOutput).not.toContain(process.env["CLA_RECORDS_TOKEN"]);
    expect(debugOutput).toContain("remoteRepositoryName: [redacted]");
})

it('requires signature repo, agreement id, agreement version, agreement path, and a private repo token', () => {
    for (const requiredInput of ["signature-repo", "agreement-id", "agreement-version", "agreement-path"]) {
        const saved = inputs[requiredInput];
        inputs[requiredInput] = "";
        expect(() => inputHelper.getInputs()).toThrow(requiredInput);
        inputs[requiredInput] = saved;
    }

    delete process.env["CLA_RECORDS_TOKEN"];
    expect(() => inputHelper.getInputs()).toThrow("private signature repository token");

    inputs["signature-repo-token"] = "token-from-input";
    expect(inputHelper.getInputs().repositoryAccessToken).toBe("token-from-input");

    inputs["signature-repo-token"] = "";
    inputs["remote-repo-pat"] = "legacy-token";
    expect(inputHelper.getInputs().repositoryAccessToken).toBe("legacy-token");
});

it('rejects invalid repository and unsafe path arguments', () => {
    inputs["signature-repo"] = "a-bad-repo-name";
    expect(() => inputHelper.getInputs()).toThrow("owner/repo-name");
    inputs["signature-repo"] = "cla-org/cla-records";

    inputs["agreement-id"] = "org/cla";
    expect(() => inputHelper.getInputs()).toThrow("agreement-id");
    inputs["agreement-id"] = "org-cla";

    inputs["agreement-version"] = "v1%2f..%2fsecret";
    expect(() => inputHelper.getInputs()).toThrow("agreement-version");
    inputs["agreement-version"] = "v1";

    inputs["agreement-path"] = "../agreements/v1.md";
    expect(() => inputHelper.getInputs()).toThrow("agreement-path");
    inputs["agreement-path"] = "agreements/org-cla/v1.md";

    inputs["repo-policy-path"] = "repo-policy/%2e%2e/secret.json";
    expect(() => inputHelper.getInputs()).toThrow("repo-policy-path");
    inputs["repo-policy-path"] = "";

    inputs["branch"] = "feature/../../main";
    expect(() => inputHelper.getInputs()).toThrow("branch");
});

it("throws if signature regex doesn't match signature text", () => {
    inputs["signature-text"] = "sometext";
    expect(() => inputHelper.getInputs()).toThrow();

    inputs["signature-text"] = undefined;
    expect(inputHelper.getInputs()).toBeTruthy();
});
