'use strict';

var path = require('path');
var webpack = require('webpack');
var merge = require('webpack-merge');
var baseWebpackConfig = require('./webpack.base.conf.js');
var ngAnnotatePlugin = require('ng-annotate-webpack-plugin');
var AsyncUglifyJs = require("async-uglify-js-webpack-plugin");

var devWebpackConfig = {
    entry: {
        index: './index.prod.js'
    },
    plugins: [
        new webpack.optimize.OccurenceOrderPlugin(),
        new ngAnnotatePlugin({
            add: true,
        }),
        new AsyncUglifyJs({
            delay: 5000,
            minifyOptions: { reservedNames: 'ATMWebProxyUrl' },
            logger: false,
            done: function (path, originalContents) { }
        })
    ]
};


module.exports = merge(baseWebpackConfig, devWebpackConfig);
