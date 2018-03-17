const { apply } = require('async')
const metamapBot = require('./botCode')
const ChannelSetting = require('./models/ChannelSetting')

// will store the bot instances that are running
const bots = {}

// setup a function for persisting channel settings
function persistChannelSetting (type, id, channelSettings, channelId, mapId, metacodeId, capture) {
  let channelSetting = channelSettings.find(cS => cS.get('channel_id') === channelId)
  if (!channelSetting) {
    channelSetting = new ChannelSetting({
      channel_id: channelId,
      team_id: id,
      serverType: type
    })
    channelSettings.push(channelSetting)
  }
  channelSetting.capture = capture
  channelSetting.map_id = mapId
  channelSetting.metacode_id = metacodeId
  channelSetting.save()
}

// setup a function which will spin up a bot for a team
async function startBot(type, botConfig, tokens = {}, mmUserIds = {}, channelSettings = []) {
  let id
  if (type === 'slack') {
    id = botConfig.get('team_id')
  } else if (type === 'mattermost') {
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
      type,
      botConfig,
      tokens,
      mmUserIds,
      channelSettingsObj,
      apply(persistChannelSetting, type, id, channelSettings)
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