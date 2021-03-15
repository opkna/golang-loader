import * as child_process from 'child_process';
import * as util from 'util';

import logger from './logging';

let execAsync = util.promisify(child_process.exec);
let execFileAsync = util.promisify(child_process.execFile);

export async function exec(cmd: string) {
    logger.debug(`cmd: ${cmd}`);
    const res = await execAsync(cmd);
    if (res.stdout) logger.debug(`stdout: ${res.stdout.trim()}`);
    if (res.stderr) logger.debug(`stderr: ${res.stderr.trim()}`);
    return res;
}
export async function execFile(
    file: string
): Promise<{ stdout: string; stderr: string }>;
export async function execFile(
    file: string,
    args: string[]
): Promise<{ stdout: string; stderr: string }>;
export async function execFile(
    file: string,
    args: string[],
    options?: child_process.ExecFileOptions
): Promise<{ stdout: string; stderr: string }>;
export async function execFile(
    file: string,
    args?: string[],
    options?: child_process.ExecFileOptions
) {
    logger.debug(`cmd: ${file} ${args.join(' ')}`);
    logger.debug(`options: ${JSON.stringify(options, null, 4)}`);
    const res = await execFileAsync(file, args, options);
    if (res.stdout) logger.debug(`stdout: ${res.stdout.trim()}`);
    if (res.stderr) logger.debug(`stderr: ${res.stderr.trim()}`);
    return res;
}
