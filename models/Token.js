const mongoose = require('mongoose')

const Token = mongoose.model('Token', {
  access_token: String,
  key: String,
  mm_user_id: String,
  user_id: String,
  team_id: String
})

module.exports = Token