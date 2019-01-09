const path = require('path');
const webpack = require('webpack');

module.exports = {
	entry: {
		loggingWorker: './src/workers/loggingWorker.ts',
		netWorker: './src/workers/netWorker.ts',
		sqsWorker: './src/workers/sqsWorker.ts'
	},
	devtool: 'inline-source-map',
	module: {     
		rules: [
			{
				test: /\.tsx?$/, 
				use: 'ts-loader', 
				exclude: /node_modules/
			}]
	},
	resolve: {
		extensions: [ '.tsx', '.ts', '.js' ]
	},
	output: {
		filename: '[name].js',     
		path: path.resolve(__dirname, 'src/assets')
	}
}
