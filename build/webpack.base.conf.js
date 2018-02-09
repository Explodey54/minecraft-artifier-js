'use strict';

const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
    context: path.join(__dirname, '../app'),
    entry: {
        index: './index.js'
    },
    output: {
        path: path.join(__dirname, '../web'),
        filename: '[name].[hash].js'
    },
    module: {
        loaders: [
            { test: /\.(png|jpg|gif|css)$/, loader: 'file-loader' }
        ]
    },
    plugins: [
        new CopyWebpackPlugin([
            { from: 'style.css', to: 'style.css'},
            { from: 'convert.js', to: 'convert.js'},
        ]),
        new HtmlWebpackPlugin({
            template: 'index.html',
            inject: true
        })
        // new CopyWebpackPlugin([
        //     { from: 'assets/img', to: path.join(__dirname, '../web/assets/img')}
        // ])
    ]
};
