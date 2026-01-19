const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const CopyPlugin = require("copy-webpack-plugin")

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production"

  return {
    entry: "./src/index.jsx",
    output: {
      path: path.resolve(__dirname, "build"),
      filename: "bundle.js",
      publicPath: "",
      clean: true,
    },
    mode: isProduction ? "production" : "development",
    devtool: isProduction ? false : "source-map",
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./public/index.html",
        inject: "body",
        minify: isProduction,
      }),
      // Copy DuckDB WASM files to build output
      new CopyPlugin({
        patterns: [
          {
            from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm",
            to: "duckdb-mvp.wasm",
          },
          {
            from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm",
            to: "duckdb-eh.wasm",
          },
          {
            from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js",
            to: "duckdb-browser-mvp.worker.js",
          },
          {
            from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js",
            to: "duckdb-browser-eh.worker.js",
          },
        ],
      }),
    ],
    resolve: {
      extensions: [".js", ".jsx"],
    },
    stats: isProduction ? "normal" : "verbose",
  }
}
