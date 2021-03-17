import { readFile } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { GolangCompiler } from './common';
import conf from '../configuration';
import { exec } from '../commands';
import logger from '../logging';

const PATH_SEPARATOR = os.platform() === 'win32' ? ';' : ':';

type MountPaths = {
    tmpFolder: string;
    resourceFolder: string;
    goPaths: string[];
};
type Paths = ;

export class GolangCompilerDocker extends GolangCompiler {
    private _getFullImage() {
        const image =
            this._options.image ??
            (this._options.tinygo
                ? conf.defaults.imageTinygo
                : conf.defaults.imageGolang);
        return `${image}:${this._options.imageTag}`;
    }

    private async _downloadImage(image: string) {
        try {
            // Try to inspect image, throws error if it does not exist
            await exec(`docker image inspect ${image} -f {{.RepoTags}}`);
            // Image already exist, do nothing
            return;
        } catch (_) {}

        logger.log(
            `Image ${image} could not be found locally, downloading from repository...`
        );
        await exec(`docker pull ${image}`);
        logger.log(`Downloaded ${image} succesfully.`);
    }

    private _createBuildCmd(resourceFile: string, outputName: string) {
        return [
            ...(this._options.tinygo
                ? ['tinygo', 'build', '-target wasm']
                : ['go', 'build']),
            `-o ${outputName}`,
            resourceFile,
        ].join(' ');
    }

    protected async _compile(
        resourceFolder: string,
        _: string,
        resourceFile: string,
        hash: string,
        tmpFolder: string
    ) {
        // Get image name and start download (if needed)
        const image = this._getFullImage();
        const imagePromise = this._downloadImage(image);

        const paths: {
            local: MountPaths;
            cont: MountPaths;
        } = {
            local: {
                tmpFolder: tmpFolder,
                resourceFolder: resourceFolder,
                goPaths: [],
            },
            cont: {
                tmpFolder: conf.docker.tmpdir,
                resourceFolder: conf.docker.workdir,
                goPaths: [],
            },
        };

        // Handle GOPATH if it exist
        const goPath = process.env['GOPATH'];
        if (goPath) {
            logger.debug(`GOPATH: ${goPath}`);
            const goPaths = goPath.split(PATH_SEPARATOR);
            for (let i = 0; i < goPaths.length; i++) {
                // Add path from GOPATH to local goPaths
                paths.local.goPaths.push(goPaths[i]);
                // Create unique container path and add to container goPaths
                const idx = `${i}`.padStart(3, '0');
                paths.cont.goPaths.push(`/gopaths/gopath_${idx}`);
            }
        } else {
            logger.debug('No GOPATH found');
        }

        // Create mount for the resource folder and tmp folder
        const mounts = [
            `${path.toNamespacedPath(paths.local.resourceFolder)}:${paths.cont.resourceFolder}`,
            `${path.toNamespacedPath(paths.local.tmpFolder)}:${paths.cont.tmpFolder}`,
        ];
        // Create mounts linking all local paths in GOPATH to folder on container
        for(let i = 0; i < paths.local.goPaths.length; ++i) {
            mounts.push(`${path.toNamespacedPath(paths.local.goPaths[i])}:${paths.cont.goPaths[i]}`;)
        }
        logger.debug(`mounts: ${mounts.join('\n')}`);

        const envs: Record<string, string> = {
            // Create GOPATH for container
            GOPATH: paths.cont.goPaths.join(':'),
        };

        // Create build command
        const outputFile = `${hash}.wasm`;
        const buildCmd = this._createBuildCmd(
            resourceFile,
            path.join(conf.docker.tmpdir, outputFile)
        );

        // Create docker command
        const dockerArgs = [
            'run',
            `--name ${conf.docker.containerPrefix + hash}`,
            '--rm',
            `-w ${conf.docker.workdir}`,
        ];
        // Add environment variables
        for (let key in envs) {
            dockerArgs.push('-e', `${key}=${envs[key]}`);
        }
        // Add mounts
        for (let mount of mounts) {
            dockerArgs.push('-v', mount);
        }
        dockerArgs.push(image, buildCmd);

        const dockerCmd = `docker ${dockerArgs.join(' ')}`;

        // Wait for docker image dowload to finish and then run command
        await imagePromise;
        await exec(dockerCmd);

        return readFile(path.resolve(tmpFolder, outputFile));
    }
}
