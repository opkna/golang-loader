import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';

import { GolangLoaderOptions } from './options';
import conf from './configuration';
import logger from './logging';
import { exec } from './commands';

let readFileAsync = util.promisify(fs.readFile);
let mkdirAsync = util.promisify(fs.mkdir);
let copyFile = util.promisify(fs.copyFile);

function getFullImage(opt: Required<GolangLoaderOptions>) {
    const image =
        opt.image ??
        (opt.tinygo ? conf.default.imageTinygo : conf.default.imageGolang);
    return `${image}:${opt.imageTag}`;
}

async function downloadImage(image: string) {
    try {
        // Try to inspect image, throws error if it does not exist
        await exec(`docker image inspect ${image} -f {{.RepoTags}}`);
        return;
    } catch (_) {}

    logger.log(
        `Image ${image} could not be found locally, downloading from repository`
    );
    await exec(`docker pull ${image}`);
}

function createBuildCmd(useTinygo: boolean, fileName: string, outFile: string) {
    if (useTinygo) {
        return ['tinygo build', '-target wasm', `-o ${outFile}`, fileName].join(
            ' '
        );
    } else {
        return ['go build', `-o ${outFile}`, fileName].join(' ');
    }
}

function createRunCmd(
    useTinygo: boolean,
    tmpFolder: string,
    image: string,
    cmd: string
) {
    if (useTinygo) {
        return [
            'docker run',
            `-v "${tmpFolder}:/workdir"`,
            '-w "/workdir"',
            image,
            cmd,
        ].join(' ');
    } else {
        return [
            'docker run',
            `-v "${tmpFolder}:/workdir"`,
            '-w "/workdir"',
            '-e "GOOS=js"',
            '-e "GOARCH=wasm"',
            image,
            cmd,
        ].join(' ');
    }
}

export async function compileGoDocker(
    resourcePath: string,
    tmpFolder: string,
    opt: Required<GolangLoaderOptions>
) {
    // Create tmp folder in case it does not exist
    await mkdirAsync(tmpFolder, { recursive: true });

    // Copy resource file to tmp folder
    const fileName = path.basename(resourcePath);
    await copyFile(resourcePath, path.join(tmpFolder, fileName));

    const image = getFullImage(opt);
    await downloadImage(image);

    // Construct docker command
    const outFile = 'module.wasm';
    const buildCmd = createBuildCmd(opt.tinygo, fileName, outFile);
    const runCmd = createRunCmd(opt.tinygo, tmpFolder, image, buildCmd);

    const { stderr } = await exec(runCmd);
    if (stderr) {
        logger.warning(stderr);
    }

    return readFileAsync(path.join(tmpFolder, outFile));
}
