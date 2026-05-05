import { jest } from '@jest/globals';

export const context: any = {
    issue: { number: 1 },
    payload: {},
    workflow: "CLA",
    ref: "",
    sha: "",
    repo: {
        owner: "owner",
        repo: "repo",
    },
};

export function getOctokit(_token: string): any {
    const api = {
        issues: {
            createComment: jest.fn(),
            updateComment: jest.fn(),
            listComments: jest.fn(),
            lock: jest.fn(),
        },
        repos: {
            get: jest.fn(),
            getContents: jest.fn(),
            getContent: jest.fn(),
            createOrUpdateFile: jest.fn(),
            createOrUpdateFileContents: jest.fn(),
        },
        actions: {
            listWorkflowRuns: jest.fn(),
            listRepoWorkflows: jest.fn(),
            reRunWorkflow: jest.fn(),
        },
        pulls: {
            get: jest.fn(),
        },
        graphql: jest.fn(),
    };

    return {
        ...api,
        rest: api,
    };
}
