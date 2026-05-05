import { SignEvent } from './signEvent';

/**
 * Blockchain storage is intentionally unsupported. The class remains only as a
 * compatibility stub for consumers that imported it directly.
 */
export class BlockchainPoster {
    constructor(_settings?: unknown) {}

    public async postToBlockchain(_signEvent: SignEvent[]): Promise<void> {
        return;
    }
}
