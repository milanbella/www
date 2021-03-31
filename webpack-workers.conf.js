const path = require('path');
const webpack = require('webpack');


module.exports = (env, argv) => {

	// Production config file.
	let config = { 	
		entry: {
			loggingWorker: './src/workers/loggingWorker.ts',
			netWorker: './src/workers/netWorker.ts',
			stompWorker: './src/workers/stompWorker.ts',
			pouchWorker: './src/workers/pouchWorker.ts',
			commonWorker: './src/workers/commonWorker.ts',
		},
		module: {     
			rules: [
				{
					test: /\.tsx?$/, 
					use: [
						{
							loader: 'ts-loader', 
							options: {
								configFile: '../../tsconfig.json'
							},
						}
					],
					exclude: [/node_modules/],
				}]
		},
		resolve: {
			extensions: [ '.tsx', '.ts', '.js' ]
		},
		output: {
			filename: '[name].js',     
			path: path.resolve(__dirname, './dist/assets')
		}		
	}

	if (argv.mode === 'production') {
	}

	if (argv.mode === 'development') {
		config.devtool = 'inline-source-map';
		config.module.rules[0].use[0].options.configFile = '../../tsconfig.dev.json'
	}


	return config;
};
