'use strict';

const path = require('path')
const webpack = require('webpack')
// const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const config = {
    imgSizes: [0.125, 0.25, 0.5, 1, 2, 4]
}

// image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
//     // x, y is the position of this pixel on the image
//     // idx is the position start position of this rgba tuple in the bitmap Buffer
//     // this is the image

//     var red   = this.bitmap.data[ idx + 0 ];
//     var green = this.bitmap.data[ idx + 1 ];
//     var blue  = this.bitmap.data[ idx + 2 ];
//     var alpha = this.bitmap.data[ idx + 3 ];

//     // rgba values run from 0 - 255
//     // e.g. this.bitmap.data[idx] = 0; // removes red from this pixel
// });

// Jimp.read("static/sprites/test.png", function (err, img) {
//     if (err) throw err;
//     img.resize(102, 77, Jimp.RESIZE_BICUBIC)
//          .write("static/sprites/test1.png");
// });

module.exports = {
    context: path.join(__dirname, '../'),
    entry: {
        index: './index.js'
    },
    output: {
        path: path.join(__dirname, '../web'),
        filename: '[name].js'
    },
    module: {
        loaders: [
            { test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: "url-loader?limit=10000&minetype=application/font-woff" },
            { test: /\.(png|jpg|gif)$/, loader: 'file-loader' }
        ]
    },
    plugins: [
        // new webpack.optimize.OccurenceOrderPlugin(),
        new HtmlWebpackPlugin({
          template: './index.html',
          inject: true
        }),
        // new CopyWebpackPlugin([
        //     { from: 'assets/img', to: path.join(__dirname, '../web/assets/img')}
        // ])
    ]
};
