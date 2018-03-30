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
            { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" },
            { test: /\.(png|jpg|gif)$/, loader: 'file-loader' },
            { test: /\.css$/, loader: 'style-loader!css-loader' }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'index.html',
            inject: true
        })
    ]
};
