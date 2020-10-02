const path = require('path');

module.exports = {
	mode: 'development',
	entry: {
		app: './js/MainPage/CascadeMain.js',
		'editor.worker': './node_modules/monaco-editor/esm/vs/editor/editor.worker.js',
		'json.worker'  : './node_modules/monaco-editor/esm/vs/language/json/json.worker',
		'css.worker'   : './node_modules/monaco-editor/esm/vs/language/css/css.worker',
		'html.worker'  : './node_modules/monaco-editor/esm/vs/language/html/html.worker',
		'ts.worker'    : './node_modules/monaco-editor/esm/vs/language/typescript/ts.worker'
	},
	output: {
		globalObject: 'self',
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist')
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.ttf$/,
				use: ['file-loader']
			}
		]
	}
};
