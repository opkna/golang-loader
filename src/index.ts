import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import rimraf from 'rimraf';
import { loader } from 'webpack';
import { getOptions } from 'loader-utils';

import { GolangLoaderOptions, validateOptions } from './options';
import { compileGoLocal } from './local';
import { compileGoDocker } from './docker';

function createCachePath(hash: string) {
    return path.resolve(os.tmpdir(), `goml-${hash}`);
}
function createHash(seed: string) {
    return crypto.createHash('md5').update(seed).digest('hex');
}

async function compileGo(resourcePath: string, options: GolangLoaderOptions) {
    // Create hash from file path
    const hash = createHash(resourcePath);
    // Use hash to create tmp folder, so the same resource get's the same cache folder every compile
    const goCachePath = createCachePath(hash);

    try {
        if (!!options.clearCache) {
            // Removes cache (if it exist) before compiling, ignore error if does not exist
            await new Promise((resolve) => {
                rimraf(goCachePath, resolve);
            });
        }
        return await (!!options.useDocker
            ? compileGoDocker(resourcePath, goCachePath)
            : compileGoLocal(resourcePath, goCachePath));
    } finally {
        if (!!options.clearCache) {
            // Remove compiled binary and GO cache directory. Ignore any error if the files are not there anyway
            rimraf(goCachePath, () => {});
        }
    }
}

export default async function (this: loader.LoaderContext) {
    // Make loader async
    const callback = this.async();
    if (!callback)
        throw new Error(
            "Could not make loader async. 'golang-loader' requires a async loader."
        );

    try {
        // Get and validate options
        const options = getOptions(this);
        validateOptions(options);

        // Compile to wasm
        const wasmFile = await compileGo(this.resourcePath, options);

        // Emit file to webpack
        const emittedWasmPath =
            path.basename(this.resourcePath, '.go') + '.wasm';
        this.emitFile(emittedWasmPath, wasmFile, null);

        // Create and return module code
        const code = `export default fetch("${emittedWasmPath}")`;
        callback(null, code);
        return;
    } catch (err) {
        // Forward error to webpack
        callback(err);
        return;
    }
}
