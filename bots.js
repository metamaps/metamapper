const { apply } = require('async')
const metamapBot = require('./create-from-slack')
const ChannelSetting = require('./models/ChannelSetting')

// will store the bot instances that are running
const bots = {}

// setup a function for persisting channel settings
function persistChannelSetting (teamId, channelSettings, channelId, mapId, metacodeId, capture) {
  let channelSetting = channelSettings.find(cS => cS.get('channel_id') === channelId)
  if (!channelSetting) {
    channelSetting = new ChannelSetting({
      channel_id: channelId,
      team_id: teamId
    })
    channelSettings.push(channelSetting)
  }
  channelSetting.capture = capture
  channelSetting.map_id = mapId
  channelSetting.metacode_id = metacodeId
  channelSetting.save()
}

// setup a function which will spin up a bot for a team
function startBotForTeam(team, tokens = {}, mmUserIds = {}, channelSettings = []) {
  const teamId = team.get('team_id')
  const channelSettingsObj = {}
  channelSettings.forEach(function (cS) {
    channelSettingsObj[cS.get('channel_id')] = {
      map: cS.get('map_id'),
      metacode: cS.get('metacode_id'),
      capture: cS.capture
    }
  })
  bots[teamId] = metamapBot.setup(
    {
      name: team.get('team_name'),
      accessToken: team.get('access_token'),
      botToken: team.get('bot_access_token'),
      botId: team.get('bot_user_id')
    },
    tokens,
    mmUserIds,
    channelSettingsObj,
    apply(persistChannelSetting, teamId, channelSettings)
  )
}

module.exports = {
  persistChannelSetting: persistChannelSetting,
  startBotForTeam: startBotForTeam,
  getBot: function (teamId) {
    return bots[teamId]
  }
}