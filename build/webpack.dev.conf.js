"use strict";

var path = require("path");
var merge = require("webpack-merge");
var baseWebpackConfig = require("./webpack.base.conf.js");

var devWebpackConfig = {
  devServer: {
    clientLogLevel: "warning",
    historyApiFallback: true,
    hot: true,
    compress: true,
    host: "localhost",
    port: 4000,
    // outputPath: path.join(__dirname, '../web'),
    contentBase: "./web",
    proxy: {},
    quiet: true, // necessary for FriendlyErrorsPlugin
    watchOptions: {
      poll: false,
    },
  },
};

module.exports = merge(baseWebpackConfig, devWebpackConfig);
console.log("Server launched on port: " + devWebpackConfig.devServer.port);
