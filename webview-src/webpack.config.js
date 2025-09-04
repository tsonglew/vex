const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
    const isDevelopment = argv.mode === 'development';

    return {
        entry: './src/index.tsx',
        output: {
            path: path.resolve(__dirname, '../media'),
            filename: 'static/js/main.js',
            publicPath: './',
            clean: false, // Don't clean media folder as it may contain other assets
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        optimization: {
            splitChunks: false,
            runtimeChunk: false,
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/i,
                    use: [MiniCssExtractPlugin.loader, 'css-loader'],
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './public/index.html',
                filename: 'index.html',
                inject: 'body',
                minify: !isDevelopment,
            }),
            new MiniCssExtractPlugin({
                filename: 'static/css/main.css',
            }),
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, '../media'),
            },
            port: 3000,
            hot: true,
            writeToDisk: true, // Write files to disk for VS Code to pick up
        },
        devtool: isDevelopment ? 'source-map' : false,
    };
};
