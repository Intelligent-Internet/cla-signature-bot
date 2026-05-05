import { IInputSettings } from "../src/inputSettings";
import { BlockchainPoster } from "../src/blockchainPoster";

const fetchMock = jest.fn();

afterEach(() => {
    jest.resetAllMocks();
    global.fetch = undefined as any;
})

it("Returns early if the flag is false", async () => {
    const settings = {
        blockchainStorageFlag: false
    } as IInputSettings

    const poster = new BlockchainPoster(settings);
    await poster.postToBlockchain([]);

    expect(fetchMock).toHaveBeenCalledTimes(0);
});

it("Posts the whole input array", async() => {
    global.fetch = fetchMock.mockImplementation((): Promise<any> => {
        return Promise.resolve({
            json() {
                return Promise.resolve({success: true});
            }
        })
    })
    const settings = {
        blockchainStorageFlag: true,
        blockchainWebhookEndpoint: "example.com"
    } as IInputSettings

    const poster = new BlockchainPoster(settings);
    await poster.postToBlockchain([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(settings.blockchainWebhookEndpoint, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: "[]"
    });
})
