import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';

let execAsync = util.promisify(child_process.exec);
let execFileAsync = util.promisify(child_process.execFile);
let readFileAsync = util.promisify(fs.readFile);

function goBinPath(goRoot: string) {
    return path.resolve(goRoot, 'bin', 'go');
}

/**
 * Finds and returns GOROOT and GOPATH
 */
async function getGoPaths() {
    let GOROOT = process.env.GOROOT;
    let GOPATH = process.env.GOPATH;

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
export async function compileGoLocal(resourcePath: string, tmpFolder: string) {
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
