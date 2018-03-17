const mongoose = require('mongoose')

const Token = mongoose.model('Token', {
  access_token: String,
  key: String,
  mm_user_id: String,
  user_id: String,
  team_id: String,
  server_type: String // slack or mattermost, or another server type
})

module.exports = Token