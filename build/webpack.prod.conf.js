'use strict';

var path = require('path');
var webpack = require('webpack');
var merge = require('webpack-merge');
var baseWebpackConfig = require('./webpack.base.conf.js');

var devWebpackConfig = {
    entry: {
        index: './index.js'
    },
    plugins: [
        // new webpack.optimize.OccurenceOrderPlugin(),
        // new ngAnnotatePlugin({
        //     add: true,
        // }),
        // new AsyncUglifyJs({
        //     delay: 5000,
        //     minifyOptions: { reservedNames: 'ATMWebProxyUrl' },
        //     logger: false,
        //     done: function (path, originalContents) { }
        // })
    ]
};


module.exports = merge(baseWebpackConfig, devWebpackConfig);
