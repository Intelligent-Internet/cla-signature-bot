import { Author } from "./authorMap";
import { IInputSettings } from "./inputSettings";
import { SignEvent } from "./signEvent";

export interface SignatureRecord {
    schema_version: 1;
    github_id: number;
    github_login_at_signing: string;
    email: string;
    email_source: string;
    agreement_id: string;
    agreement_version: string;
    agreement_sha256: string;
    signed_at: string;
    signed_from_repo: string;
    signed_from_pr: number;
    signature_method: "github_issue_comment";
    workflow_run_id?: number;
    comment_id: number;
}

export function buildSignatureRecord(
    signEvent: SignEvent,
    author: Author | undefined,
    settings: IInputSettings,
    agreementSha256: string
): SignatureRecord {
    return {
        schema_version: 1,
        github_id: signEvent.id,
        github_login_at_signing: signEvent.name,
        email: author?.email || signEvent.email || "",
        email_source: author?.emailSource || signEvent.email_source || "unknown",
        agreement_id: settings.agreementId,
        agreement_version: settings.agreementVersion,
        agreement_sha256: agreementSha256,
        signed_at: new Date(signEvent.created_at).toISOString(),
        signed_from_repo: `${settings.localRepositoryOwner}/${settings.localRepositoryName}`,
        signed_from_pr: settings.pullRequestNumber,
        signature_method: "github_issue_comment",
        workflow_run_id: settings.workflowRunId,
        comment_id: signEvent.comment_id,
    };
}
