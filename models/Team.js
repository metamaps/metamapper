const mongoose = require('mongoose')

const Team = mongoose.model('Team', {
  access_token: String, // the access token of the bot within the team
  team_name: String,
  team_id: String,
  bot_user_id: String,
  bot_access_token: String
})

module.exports = Team