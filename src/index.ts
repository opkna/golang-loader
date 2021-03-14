import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import rimraf from 'rimraf';
import { loader } from 'webpack';
import { getOptions } from 'loader-utils';
import { validate } from 'schema-utils';
import { Schema } from 'schema-utils/declarations/validate';

import config from './configuration';

type GolangLoaderOptions = {
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
function validateOptions(
    options: unknown
): asserts options is GolangLoaderOptions {
    if (typeof options !== 'object')
        throw new Error("'golang-loader:' Options is not a object");

    validate(optionsSchema, options, {
        baseDataPath: 'options',
        name: 'GolangLoaderOptions',
    });
}

let execAsync = util.promisify(child_process.exec);
let execFileAsync = util.promisify(child_process.execFile);
let readFileAsync = util.promisify(fs.readFile);
let mkdirAsync = util.promisify(fs.mkdir);
let copyFile = util.promisify(fs.copyFile);

function goBinPath(goRoot: string) {
    return path.resolve(goRoot, 'bin', 'go');
}
function createCachePath(hash: string) {
    return path.resolve(os.tmpdir(), `goml-${hash}`);
}
function createHash(seed: string) {
    return crypto.createHash('md5').update(seed).digest('hex');
}

/**
 * Finds and returns GOROOT and GOPATH
 */
async function getGoPaths() {
    let GOROOT = process.env.GOROOT;
    if (!GOROOT) {
        try {
            // Try to get GOROOT with 'go env' command
            const { stdout } = await execAsync('go env GOROOT');
            GOROOT = stdout.trim();
        } catch (err) {
            // Unable to find go binary, panic!
            throw Error(
                `Can't find Go! (GOROOT is not set, and go binary is not in PATH)`
            );
        }
    }

    let GOPATH = process.env.GOPATH;
    if (!GOPATH) {
        // Get GOPATH with 'go env'
        const bin = goBinPath(GOROOT);
        const { stdout } = await execFileAsync(bin, ['env', 'GOPATH']);
        GOPATH = stdout.trim();
    }

    return {
        GOROOT,
        GOPATH,
    };
}

/**
 * Will compile a Go file or module and return the wasm binary
 *
 * @param resourcePath Path to `.go` or `.mod` file.
 * @param clearCache If true, will clear cache before and after compilation
 */
async function compileGoLocal(resourcePath: string, tmpFolder: string) {
    // Folder where GO source is located
    const srcDir = path.dirname(resourcePath);

    // Get filename of GO source
    const inputFile = path.basename(resourcePath);

    // Get all Go related env vars
    const goEnvs = await getGoPaths();

    // Compile to wasm
    const outFilePath = path.resolve(tmpFolder, 'module.wasm');
    const bin = goBinPath(goEnvs.GOROOT);
    const args = ['build', '-o', outFilePath, inputFile];
    const opts: child_process.ExecFileOptions = {
        cwd: srcDir,
        env: {
            ...goEnvs,
            GOCACHE: tmpFolder,
            GOOS: 'js',
            GOARCH: 'wasm',
        },
    };
    await execFileAsync(bin, args, opts);

    // Read and return the compiled wasm binary
    return readFileAsync(outFilePath);
}

async function compileGoDocker(resourcePath: string, tmpFolder: string) {
    const image = `${config.defaultGolangDockerImage}:${config.defaultGolangDockerTag}`;

    // Create tmp folder in case it does not exist
    await mkdirAsync(tmpFolder, { recursive: true });

    // Copy resource file to tmp folder
    const fileName = path.basename(resourcePath);
    await copyFile(resourcePath, path.join(tmpFolder, fileName));

    const outFile = 'module.wasm';
    const cmd = [
        'docker run',
        `-v "${tmpFolder}:/workdir"`,
        '-w "/workdir"',
        '-e "GOOS=js"',
        '-e "GOARCH=wasm"',
        image,
        'go build',
        `-o ${outFile}`,
        fileName,
    ].join(' ');

    const res = await execAsync(cmd);
    if (res.stderr) {
        throw new Error(res.stderr);
    }

    return readFileAsync(path.join(tmpFolder, outFile));
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
