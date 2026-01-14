const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production"

  return {
    entry: "./src/index.jsx",
    output: {
      path: path.resolve(__dirname, "build"),
      filename: "bundle.js",
      publicPath: "/",
      clean: true, // Clean build directory before each build
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
        minify: isProduction, // Minify in production
      }),
    ],
    resolve: {
      extensions: [".js", ".jsx"],
    },
    stats: isProduction ? "normal" : "verbose",
  }
}
