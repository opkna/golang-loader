# golang-loader

Webpack loader that simply compiles GO into WebAssembly

## Install

Install witn npm:

```bash
npm install --save-dev golang-loader
```

or with yarn:

```bash
yarn add -D golang-loader
```

> Note: `go` also have to be installed. And either have `go` in `PATH`, or have `GOROOT` set.

## Usage

**webpack.config.js**

```js
module.exports = {
    // ...
    module: {
        rules: [
            {
                test: /\.go$/,
                use: 'golang-loader',
            },
        ],
    },
};
```

> To be able to test this loader you need to use a development server, otherwise `CORS` will block the fetch for the `wasm` file. Also the dev server need to be able to handle the `application/wasm` MIME type. **webpack-dev-server** work well on both counts.
