const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    entry: ['./resources/js/index.js', './resources/scss/style.scss'],
    output: {
        filename: 'script.js',
        path: path.resolve(__dirname, 'app/static'),
    },
    mode: 'production',
    plugins: [
        new MiniCssExtractPlugin({
            filename: './style.css',
        }),
    ],
    module: {
        rules: [
            {
                test: /\.(scss|css)$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                    },
                    {
                        loader: 'css-loader',
                        options: {
                            modules: false,
                        },
                    },
                    { loader: 'sass-loader' },
                ],
            },
        ],
    },
};
