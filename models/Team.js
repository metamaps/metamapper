const mongoose = require('mongoose')

const Team = mongoose.model('Team', {
  access_token: String, // the access token of the bot within the team
  team_name: String,
  team_id: String,
  bot_user_id: String,
  bot_access_token: String,
  project_map_id: String // this was/is a custom feature where a team could have a map set that defines projects being worked on
})

module.exports = Team