const { apply } = require('async')
const metamapBot = require('./botCode')
const ChannelSetting = require('./models/ChannelSetting')

// will store the bot instances that are running
const bots = {}

// setup a function for persisting channel settings
function persistChannelSetting (serverType, id, channelSettings, channelId, mapId, metacodeId, capture) {
  let channelSetting = channelSettings.find(cS => cS.get('channel_id') === channelId)
  if (!channelSetting) {
    channelSetting = new ChannelSetting({
      channel_id: channelId,
      team_id: id,
      server_type: serverType
    })
    channelSettings.push(channelSetting)
  }
  channelSetting.capture = capture
  channelSetting.map_id = mapId
  channelSetting.metacode_id = metacodeId
  channelSetting.save()
}

// setup a function which will spin up a bot for a team
async function startBot(serverType, botConfig, tokens = {}, mmUserIds = {}, channelSettings = []) {
  let id
  if (serverType === 'slack') {
    id = botConfig.get('team_id')
  } else if (serverType === 'mattermost') {
    id = botConfig._id
  }

  const channelSettingsObj = {}
  channelSettings.forEach(function (cS) {
    channelSettingsObj[cS.get('channel_id')] = {
      map: cS.get('map_id'),
      metacode: cS.get('metacode_id'),
      capture: cS.capture
    }
  })
  try {
    bots[id] = await metamapBot.setup(
      serverType,
      botConfig,
      tokens,
      mmUserIds,
      channelSettingsObj,
      apply(persistChannelSetting, serverType, id, channelSettings)
    )
  } catch (err) {
    console.error(err)
  }
}

module.exports = {
  persistChannelSetting: persistChannelSetting,
  startBot: startBot,
  getBot: function (id) {
    return bots[id]
  }
}