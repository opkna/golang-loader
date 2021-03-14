import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';

import config from './configuration';

let readFileAsync = util.promisify(fs.readFile);
let mkdirAsync = util.promisify(fs.mkdir);
let execAsync = util.promisify(child_process.exec);
let copyFile = util.promisify(fs.copyFile);

export async function compileGoDocker(resourcePath: string, tmpFolder: string) {
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
