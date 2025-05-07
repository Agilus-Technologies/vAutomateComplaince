import * as path from 'path';

let __dirname = path.resolve();
 
 
const configs = {
  entry: './app.js',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.txt$/,
        use: 'raw-loader'
      },
      {
        test: /\.env$/,
        use: 'raw-loader'
      },
      {
        test: /\.node$/,
        use: 'node-loader',
      },
    ]
  }
};
 
export default configs;