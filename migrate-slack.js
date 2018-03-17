if (process.env.NODE_ENV !== 'production') require('dotenv').config()
const mongoose = require('mongoose')

const Token = require('./models/Token')
// ChannelSettings store configuration options for channels
const ChannelSetting = require('./models/ChannelSetting')

mongoose.connect(process.env.DB)
var db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function() {
  Token.find(function (err, tokens) {
    tokens.forEach(t => {
      t.set('server_type', 'slack')
      t.save()
    })
    ChannelSetting.find(function(err, settings) {
      settings.forEach(s => {
        s.set('server_type', 'slack')
        s.save()
      })
      process.exit()
    })
  })
})