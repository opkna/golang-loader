var debug = false;
var warning: (warn: Error) => void = undefined;

export function setDebug(debugOn: boolean) {
    debug = debugOn;
}
export function setWarning(func: (warn: Error) => void) {
    warning = func;
}

export class Logger {
    constructor() {}
    log(msg: string) {
        console.log(msg);
    }
    error(msg: string | Error) {
        const err = typeof msg === 'string' ? new Error(msg) : msg;
        console.error(err);
    }
    warning(msg: string | Error) {
        const err = typeof msg === 'string' ? new Error(msg) : msg;
        if (typeof warning === 'function') {
            warning(err);
        } else {
            console.warn(err.message);
        }
    }
    debug(msg: string) {
        if (!debug) return;

        console.debug(msg);
    }
}
const logger = new Logger();
export default logger;
