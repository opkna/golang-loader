import { getOptions } from 'loader-utils';
import * as crypto from 'crypto';
import { loader } from 'webpack';
import * as path from 'path';
import rimraf from 'rimraf';
import * as os from 'os';

import { GolangLoaderOptions, validateOptions } from './options';
import { GolangCompilerDocker } from './compilers/docker';
import logger, { setDebug, setWarning } from './logging';
import { GolangCompilerLocal } from './compilers/local';

function createTmpFolder(hash: string) {
    return path.resolve(os.tmpdir(), `golang-loader-${hash}`);
}
function createHash(seed: string) {
    return crypto.createHash('md5').update(seed).digest('hex');
}

async function compileGo(
    resourcePath: string,
    options: Required<GolangLoaderOptions>,
    hash: string
) {
    // Use hash to create tmp folder, so the same resource get's the same cache folder every compile
    const tmpFolder = createTmpFolder(hash);
    logger.debug(`tmpFolder: ${tmpFolder}`);

    try {
        if (options.clearCache) {
            // Removes cache (if it exist) before compiling, ignore error if does not exist
            await new Promise((resolve) => {
                rimraf(tmpFolder, resolve);
            });
        }

        logger.debug(`options.docker: ${options.docker}`);
        const compiler = options.docker
            ? new GolangCompilerDocker(options)
            : new GolangCompilerLocal(options);
        return compiler.compile(resourcePath, hash, tmpFolder);
    } finally {
        if (options.clearCache) {
            // Remove compiled binary and GO cache directory. Ignore any error if the files are not there anyway
            rimraf(tmpFolder, () => {});
        }
    }
}

export default async function (this: loader.LoaderContext) {
    setWarning((warn) => {
        this.emitWarning(warn);
    });

    // Make loader async
    const callback = this.async();
    if (!callback) {
        throw new Error(
            "Could not make loader async. 'golang-loader' requires a async loader."
        );
    }

    try {
        // Create hash from file path
        const hash = createHash(this.resourcePath);

        // Get and validate options
        const options = validateOptions(getOptions(this));
        setDebug(options.debug);
        logger.debug(`options:${JSON.stringify(options, null, 4)}`);

        // Compile to wasm
        const wasmFile = await compileGo(this.resourcePath, options, hash);
        logger.debug(
            `wasmFile size: ${Math.round(
                wasmFile.byteLength / (1024 * 1024)
            )} MB`
        );

        // Emit file to webpack
        const emittedWasmPath = `${hash}.wasm`;
        logger.debug(`emittedWasmPath: ${emittedWasmPath}`);
        this.emitFile(emittedWasmPath, wasmFile, null);

        // Create and return module code
        const code = `export default fetch("${emittedWasmPath}")`;
        logger.debug(`code: ${code}`);
        callback(null, code);
        return;
    } catch (err) {
        // Forward error to webpack
        callback(err);
        return;
    }
}
