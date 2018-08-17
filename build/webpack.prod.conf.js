'use strict';

var path = require('path');
var webpack = require('webpack');
var merge = require('webpack-merge');
var baseWebpackConfig = require('./webpack.base.conf.js');

var prodWebpackConfig = {
    entry: {
        index: './index.js'
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin()
    ]
};


module.exports = merge(baseWebpackConfig, prodWebpackConfig);
