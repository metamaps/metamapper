const metamapBot = require('./create-from-slack')

const ChannelSetting = require('./models/ChannelSetting')

// the full url that this server is running at
const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN
const authRoute = '/sign_in'
const authUrl = fullUrl + authRoute

// will store the bot instances that are running
const bots = {}

// setup a function which will spin up a bot for a team
module.exports = {
  startBotForTeam: function startBotForTeam(team, tokens = {}, mmUserIds = {}, channelSettings = []) {
    const toPassIn = {
      name: team.get('team_name'),
      accessToken: team.get('access_token'),
      botToken: team.get('bot_access_token'),
      botId: team.get('bot_user_id'),
      mmUserIds,
      tokens
    }
    const persistChannelSetting = function (channelId, mapId, metacodeId, capture) {
      var channelSetting = channelSettings.find(cS => cS.get('channel_id') === channelId)
      if (!channelSetting) {
        channelSetting = new ChannelSetting({
          channel_id: channelId,
          team_id: team.get('team_id')
        })
        channelSettings.push(channelSetting)
      }
      channelSetting.capture = capture
      channelSetting.map_id = mapId
      channelSetting.metacode_id = metacodeId
      channelSetting.save()
    }
    bots[team.get('team_id')] = metamapBot.setup(toPassIn, authUrl, persistChannelSetting)
  },
  getBot: function (teamId) {
    return bots[teamId]
  }
}