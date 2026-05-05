import { jest } from '@jest/globals';

export interface InputOptions {
    required?: boolean;
}

export const debug = jest.fn();
export const info = jest.fn();
export const warning = jest.fn();
export const error = jest.fn();
export const setFailed = jest.fn();
export const getInput = jest.fn((name: string, options?: InputOptions) => {
    if (options?.required) {
        throw new Error(`Input required and not supplied: ${name}`);
    }
    return "";
});
