export function repos(octokit: any): any {
    return octokit.rest?.repos || octokit.repos;
}

export function issues(octokit: any): any {
    return octokit.rest?.issues || octokit.issues;
}

export function actions(octokit: any): any {
    return octokit.rest?.actions || octokit.actions;
}

export function pulls(octokit: any): any {
    return octokit.rest?.pulls || octokit.pulls;
}
