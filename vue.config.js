const { defineConfig } = require('@vue/cli-service')
const fs = require('fs')
module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    devtool: 'source-map'
  },
  devServer:{
    https:{
      key: fs.readFileSync('./localhost/localhost.decrypted.key'),
      cert: fs.readFileSync('./localhost/localhost.crt')
    },
  }
})