const mongoose = require('mongoose')

const Mattermost = mongoose.model('Mattermost', {
  server: String,
  email: String,
  password: String
})

module.exports = Mattermost