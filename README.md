# golang-loader

Webpack loader that simply compiles GO into WebAssembly. Can compile with Go or Tinygo. Also have the ability to use Docker so nothing need to be installed locally.

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

With the default configuration you need to first install Go on your machine.

Then define a rule like this:

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

Here is an example of a Hello, world! program:

**src/main.go**

```go
package main

import (
	"fmt"
)

func main() {
	fmt.Println("Hello, world!")
}
```

To run the compiled Go code you need the glue code in `wasm_exec.js`. It's found here: `${GOROOT}/misc/wasm/wasm_exec.js` Copy that file and put it in your `src` folder.

> OBS: The glue code provided in `wasm_exec.js` contains lots of polyfills because it's written to work in a browser **and** on a NodeJS environment. This will make Webpack panic since it can't resolve any NodeJS imports. The quick fix is to add `resolve: { alias: { fs: false, crypto: false, util: false } }` to your webpack configuration. A better options is to just remove all the if-statements using `require` in `wasm_exec.js`. They are not used in the Browser anyways.

The resulting module from the import is a `fetch()` promise. Just pass that in to `WebAssembly.instantiateStreaming`, and run it using the `Go` class defined in `wasm_exec.js`.

```js
import wasm from './main.go';
import './wasm_exec';

const go = new Go();
WebAssembly.instantiateStreaming(wasm, go.importObject).then((module) => {
    go.run(module.instance);
});
```

> To be able to test this loader you need to use a development server, otherwise `CORS` will block the fetch for the `.wasm` file. Also the dev server need to be able to handle the `application/wasm` MIME type. **webpack-dev-server** work well on both counts.

### With Docker (Recommended)

To avoid the need to install Go on your machine you can set the `docker` option to `true`. This is the recommended way to use this loader.

**webpack.config.js**

```js
module.exports = {
    // ...
    module: {
        rules: [
            {
                test: /\.go$/,
                use: {
                    loader: 'golang-loader',
                    options: { docker: true },
                },
            },
        ],
    },
};
```

This of course need Docker to be installed and in your `PATH` environment variable. When running this the first time it will download the `golang` image, so it will take some time first run.

### Tinygo

You can also compile using Tinygo. This have the advantage of producing significantly smalled wasm binaries. Just set the `tinygo` options to `true`.

**webpack.config.js**

```js
module.exports = {
    // ...
    module: {
        rules: [
            {
                test: /\.go$/,
                use: {
                    loader: 'golang-loader',
                    options: { tinygo: true, docker: true },
                },
            },
        ],
    },
};
```

This can be used with and without Docker. If not then you need to install Tinygo on your machine.

> Note: Tinygo uses a different `wasm_exec.js`. You can find it here: `${TINYGOROOT}/targets/wasm_exec.js`

### TypeScript

If you are using TypeScript the compiler will throw an error when importing a `.go` file. To fix this you need to add a declaration for `.go` modules. Create a declarations file and put this code in it. Also, while you are at it. Add a declaration for the Go class is `wasm_exec.js`.

**src/declarations.d.ts**

```ts
declare module '*.go' {
    const promise: Promise<Response>;
    export default promise;
}

declare class Go {
    importObject: WebAssembly.Imports;
    readonly exited?: boolean;
    run: (instance: WebAssembly.Instance) => Promise<void>;
}
```
