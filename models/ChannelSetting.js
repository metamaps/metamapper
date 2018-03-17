const mongoose = require('mongoose')

const ChannelSetting = mongoose.model('ChannelSetting', {
  metacode_id: Number, // a currently selected default metacode to apply to created topics
  map_id: String, // the currently selelected map for a channel
  capture: Boolean, // whether to capture every message or not
  channel_id: String,
  team_id: String,
  server_type: String // slack or mattermost, or another server type
})

module.exports = ChannelSetting