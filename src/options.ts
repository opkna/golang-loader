import { Schema } from 'schema-utils/declarations/validate';
import { validate } from 'schema-utils';

import conf from './configuration';

export type GolangLoaderOptions = {
    clearCache?: boolean;
    tinygo?: boolean;
    docker?: boolean;
    image?: string | undefined;
    imageTag?: string;
    debug?: boolean;
};
const defaultOptions: Required<GolangLoaderOptions> = {
    clearCache: conf.defaults.clearCache,
    tinygo: conf.defaults.tinygo,
    docker: conf.defaults.docker,
    image: undefined,
    imageTag: conf.defaults.imageTag,
    debug: conf.defaults.debug,
};
const optionsSchema: Schema = {
    type: 'object',
    properties: {
        clearCache: {
            type: 'boolean',
        },
        tinygo: {
            type: 'boolean',
        },
        docker: {
            type: 'boolean',
        },
        image: {
            type: 'string',
        },
        imageTag: {
            type: 'string',
        },
        debug: {
            type: 'boolean',
        },
    },
    additionalProperties: false,
};

function assertOptions(
    options: object
): asserts options is GolangLoaderOptions {
    validate(optionsSchema, options, {
        baseDataPath: 'options',
        name: 'GolangLoaderOptions',
    });
}

export function validateOptions(options: unknown) {
    if (typeof options !== 'object')
        throw new Error("'golang-loader:' Options is not a object");

    assertOptions(options);

    return {
        ...defaultOptions,
        ...options,
    } as Required<GolangLoaderOptions>;
}
