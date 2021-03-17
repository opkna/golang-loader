import { readFile } from 'fs/promises';
import * as path from 'path';

import { GolangCompiler } from './common';
import { execFile } from '../commands';

export class GolangCompilerLocal extends GolangCompiler {
    protected async _compile(
        resourceFolder: string,
        resourcePath: string,
        resourceFile: string,
        hash: string,
        tmpFolder: string
    ) {
        const goRootName = this._options.tinygo ? 'TINYGOROOT' : 'GOROOT';
        const goRoot = process.env[goRootName];
        if (!goRoot) {
            throw new Error('GOROOT is not set. Unable to locate Go.');
        }

        const bin = path.resolve(
            goRoot,
            'bin',
            this._options.tinygo ? 'tinygo' : 'go'
        );
        const GOPATH = await this._getGoPath(bin);

        // File output from compilation
        const outFilePath = path.resolve(tmpFolder, `${hash}.wasm`);

        // Set arguments and env
        const env: Record<string, string> = {
            [goRootName]: goRoot,
            GOPATH,
            GOCACHE: tmpFolder,
        };
        const args = [];
        if (this._options.tinygo) {
            args.push(
                'build',
                '-target',
                'wasm',
                '-o',
                outFilePath,
                resourcePath
            );
            env['HOME'] = process.env['HOME'];
            env['PATH'] = process.env['PATH'];
        } else {
            args.push('build', '-o', outFilePath, resourceFile);
            env.GOOS = 'js';
            env.GOARCH = 'wasm';
        }

        // Compile to wasm
        await execFile(bin, args, {
            cwd: resourceFolder,
            env,
        });

        // Read and return the compiled wasm binary
        return readFile(outFilePath);
    }
}
