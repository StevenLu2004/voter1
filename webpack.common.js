const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    entry: {
        index: './src/client/index.js',
    },
    output: {
        // filename: '[name].[contenthash].js',
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
            {
                test: /\.css$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                    },
                    'css-loader',
                ],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            // filename: '[name].[contenthash].css',
            filename: '[name].css',
        }),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: 'src/client/html/index.html',
        }),
        new HtmlWebpackPlugin({
            filename: 'display/index.html',
            template: 'src/client/html/display/index.html',
        }),
        new HtmlWebpackPlugin({
            filename: 'info/index.html',
            template: 'src/client/html/info/index.html',
        }),
        new HtmlWebpackPlugin({
            filename: 'reject.html',
            template: 'src/client/html/reject.html',
        }),
    ],
};
