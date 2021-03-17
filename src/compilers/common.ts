import * as path from 'path';

import { GolangLoaderOptions } from '../options';
import { execFile } from '../commands';

export abstract class GolangCompiler {
    protected _options: Required<GolangLoaderOptions>;
    constructor(options: Required<GolangLoaderOptions>) {
        this._options = options;
    }

    protected async _getGoPath(bin: string) {
        return (await execFile(bin, ['env', 'GOPATH'])).stdout.trim();
    }

    protected abstract _compile(
        resourceFolder: string,
        resourcePath: string,
        resourceFile: string,
        hash: string,
        tmpFolder: string
    ): Promise<Buffer>;

    compile(resourcePath: string, hash: string, tmpFolder: string) {
        // Folder where Go source is located
        const resourceFolder = path.dirname(resourcePath);

        // Get filename of Go source
        const resourceFile = path.basename(resourcePath);

        return this._compile(
            resourceFolder,
            resourcePath,
            resourceFile,
            hash,
            tmpFolder
        );
    }
}
