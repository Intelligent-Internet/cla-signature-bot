import * as core from '@actions/core';
import { Author } from "./authorMap";
import { ClaFileRepository } from "./claFileRepository";
import { Whitelist } from "./claWhitelist";
import { IInputSettings } from "./inputSettings";
import { PullComments } from './pullComments';
import { PullAuthors } from './pullAuthors';
import { PullCheckRunner } from './pullCheckRunner';
import { buildSignatureRecord } from './signatureRecord';
import { issues } from './octokitCompat';

export class ClaRunner {
    readonly settings: IInputSettings;
    readonly claFileRepository: ClaFileRepository;
    readonly whitelist: Whitelist;
    readonly pullComments: PullComments;
    readonly pullAuthors: PullAuthors;
    readonly pullCheckRunner: PullCheckRunner;

    constructor({
        inputSettings,
        claRepo,
        claWhitelist,
        pullComments,
        pullAuthors,
        pullCheckRunner }: {
            inputSettings: IInputSettings;
            claRepo?: ClaFileRepository;
            claWhitelist?: Whitelist;
            pullComments?: PullComments;
            pullAuthors?: PullAuthors;
            pullCheckRunner?: PullCheckRunner;
        }) {
        this.settings = inputSettings;
        this.claFileRepository = (!claRepo) ? new ClaFileRepository(this.settings) : claRepo;
        this.whitelist = (!claWhitelist) ? new Whitelist(this.settings.whitelist) : claWhitelist;
        this.pullComments = (!pullComments) ? new PullComments(this.settings) : pullComments
        this.pullAuthors = (!pullAuthors) ? new PullAuthors(this.settings) : pullAuthors
        this.pullCheckRunner = (!pullCheckRunner) ? new PullCheckRunner(this.settings) : pullCheckRunner;
    }

    public async execute(): Promise<boolean> {
        if (this.settings.payloadAction === "closed") {
            // PR is closed and should be locked to preserve signatures.
            await this.lockPullRequest();
            return true;
        }

        // Just drop whitelisted authors entirely, no sense in processing them.
        const repoPolicy = await this.claFileRepository.getRepoPolicy();
        let rawAuthors: Author[] = await this.pullAuthors.getAuthors();
        if (repoPolicy?.excluded_github_ids?.length) {
            const excludedIds = new Set(repoPolicy.excluded_github_ids);
            rawAuthors = rawAuthors.filter(a => !a.id || !excludedIds.has(a.id));
        }
        rawAuthors = rawAuthors.filter(a => !this.whitelist.isUserWhitelisted(a));

        if (rawAuthors.length === 0) {
            core.info("No committers left after whitelisting. Approving pull request.");
            return true;
        }

        core.debug(`Found a total of ${rawAuthors.length} authors after whitelisting.`);
        core.debug(`Authors: ${rawAuthors.map(n => n.name).join(', ')}`);

        const agreementSha256 = await this.claFileRepository.getAgreementSha256();
        let authorMap = await this.claFileRepository.mapSignedAuthors(rawAuthors);

        let newSignature = await this.pullComments.getNewSignatures(authorMap);
        if (newSignature.length > 0) {
            const newNames = newSignature.map(s => s.name).join(', ');
            core.debug(`Found new signatures: ${newNames}.`)
            const signatureRecords = newSignature.map(sig =>
                buildSignatureRecord(
                    sig,
                    rawAuthors.find(a => a.id === sig.id),
                    this.settings,
                    agreementSha256
                )
            );

            await Promise.all([
                ...signatureRecords.map(record => this.claFileRepository.writeSignature(record)),
                this.pullCheckRunner.rerunLastCheck()
            ]);
            authorMap = await this.claFileRepository.mapSignedAuthors(rawAuthors);
            await this.pullComments.setClaComment(authorMap);
        } else {
            await this.pullComments.setClaComment(authorMap);
        }

        if (!authorMap.allSigned()) {
            core.setFailed("Waiting on additional CLA signatures.");
            return false;
        }

        return true;
    }

    private async lockPullRequest(): Promise<any> {
        core.info(`Locking pull request #${this.settings.pullRequestNumber} to safe guard the pull request's CLA signatures.`);
        try {
            await issues(this.settings.octokitLocal).lock({
                owner: this.settings.localRepositoryOwner,
                repo: this.settings.localRepositoryName,
                issue_number: this.settings.pullRequestNumber
            });
            core.info(`Successfully locked pull request #${this.settings.pullRequestNumber}.`);
        } catch (error) {
            core.error(`Failed to lock pull request #${this.settings.pullRequestNumber}.`);
        }
    }
}
