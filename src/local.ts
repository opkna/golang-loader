import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';

import { GolangLoaderOptions } from './options';
import { exec, execFile } from './commands';
import logger from './logging';

let readFileAsync = util.promisify(fs.readFile);

async function getGoEnv(compiler: string, envName: string) {
    let env = process.env[envName];
    if (env) return env;
    try {
        // Try to get GOROOT with 'go env' command
        const { stdout } = await exec(`${compiler} env ${envName}`);
        return stdout.trim();
    } catch (err) {
        // Unable to find go binary, panic!
        throw Error(`Can't find ${envName}.`);
    }
}

/**
 * Finds and returns GOROOT and GOPATH
 */
async function getPaths(useTinygo: boolean) {
    const [binName, envRootName] = useTinygo
        ? ['tinygo', 'TINYGOROOT']
        : ['go', 'GOROOT'];

    const root = await getGoEnv(binName, envRootName);
    const binPath = path.resolve(root, 'bin', binName);
    const goPath = (await execFile(binPath, ['env', 'GOPATH'])).stdout.trim();

    const roots = {
        [envRootName]: root,
    };
    if (useTinygo) {
        // Also add GOROOT if using tinygo
        roots['GOROOT'] = await getGoEnv('tinygo', 'GOROOT');
    }

    return {
        bin: binPath,
        env: {
            ...roots,
            GOPATH: goPath,
        },
    };
}

/**
 * Will compile a Go file or module and return the wasm binary
 *
 * @param resourcePath Path to `.go` or `.mod` file.
 * @param clearCache If true, will clear cache before and after compilation
 */
export async function compileGoLocal(
    resourcePath: string,
    tmpFolder: string,
    opt: Required<GolangLoaderOptions>
) {
    // Folder where Go source is located
    const srcDir = path.dirname(resourcePath);

    // File output from compilation
    const outFilePath = path.resolve(tmpFolder, 'module.wasm');

    // Get filename of Go source
    const inputFile = path.basename(resourcePath);

    // Get Golang or Tinygo paths
    const goPaths = await getPaths(opt.tinygo);

    // Set arguments and env
    const env: Record<string, string> = { ...goPaths.env, GOCACHE: tmpFolder };
    const args = ['build'];
    if (opt.tinygo) {
        args.push('-target', 'wasm');
        env.HOME = process.env.HOME;
        env.PATH = process.env.PATH,
    } else {
        env.GOOS = 'js';
        env.GOARCH = 'wasm';
    }
    args.push('-o', outFilePath, inputFile);

    // Compile to wasm
    const { stderr } = await execFile(goPaths.bin, args, {
        cwd: srcDir,
        env,
    });
    if (stderr) {
        logger.warning(stderr);
    }

    // Read and return the compiled wasm binary
    return readFileAsync(outFilePath);
}
