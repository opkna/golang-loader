export default {
    defaults: {
        clearCache: false,
        tinygo: false,
        docker: false,
        imageGolang: 'golang',
        imageTinygo: 'tinygo/tinygo',
        imageTag: 'latest',
        debug: false,
    },
    docker: {
        workdir: '/workdir',
        tmpdir: '/golang-tmp',
        containerPrefix: 'golang-loader-',
    },
};
