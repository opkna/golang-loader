import { validate } from 'schema-utils';
import { Schema } from 'schema-utils/declarations/validate';

export type GolangLoaderOptions = {
    useDocker?: boolean;
    clearCache?: boolean;
};
const optionsSchema: Schema = {
    type: 'object',
    properties: {
        useDocker: {
            type: 'boolean',
        },
        clearCache: {
            type: 'boolean',
        },
    },
    additionalProperties: false,
};
export function validateOptions(
    options: unknown
): asserts options is GolangLoaderOptions {
    if (typeof options !== 'object')
        throw new Error("'golang-loader:' Options is not a object");

    validate(optionsSchema, options, {
        baseDataPath: 'options',
        name: 'GolangLoaderOptions',
    });
}
