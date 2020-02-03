const path = require('path')
const webpack = require('webpack')

module.exports = {
  transpileDependencies: ['vuetify'],
  configureWebpack: {
    plugins: [
      new webpack.ProvidePlugin({
        '_': 'lodash',
        'moment': 'moment'
      })
    ],
    resolve: {
      alias: {
        '~': path.join(__dirname, 'src')
      }
    }
  }
}
