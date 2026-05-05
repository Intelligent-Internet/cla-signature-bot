import { BlockchainPoster } from "../src/blockchainPoster";

it("does not post signatures to any external webhook", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(jest.fn());

    const poster = new BlockchainPoster({ blockchainStorageFlag: true, blockchainWebhookEndpoint: "https://example.com" });
    await poster.postToBlockchain([{
        name: "User",
        id: 1,
        email: "user@example.com",
        pullRequestNo: 1,
        comment_id: 2,
        created_at: "2026-01-01T00:00:00.000Z",
        repoId: 3,
    }]);

    expect(fetchMock).toHaveBeenCalledTimes(0);
});
