const Promise = require('bluebird')
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
const RtmClient = require('@slack/client').RtmClient
const WebClient = require('@slack/client').WebClient
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const DataStore = require('@slack/client').MemoryDataStore
const { setClientsForTeam } = require('./clientsForTeam.js')
const { dmForUserId } = require('./clientHelpers.js')
const commands = require('./commands.js')


function setup (team, setProjectMap, authUrl, persistChannelSetting) {
  const { name, accessToken, tokens, mmUserIds, botToken, botId, projectMapId } = team
  const users = {}
  const dataStore = new DataStore()
  // the "App" has different (greater) permissions than the bot
  const webApp = new WebClient(accessToken)
  const webBot = new WebClient(botToken, {logLevel: 'info', dataStore: dataStore})
  const rtmBot = new RtmClient(botToken, {logLevel: 'info', dataStore: dataStore})
  // so they can be accesible within other modules
  setClientsForTeam(name, dataStore, webApp, webBot, rtmBot)
  rtmBot.start()

  const SLACK = commands(tokens, users, botId, authUrl, projectMapId, setProjectMap,
    team.channelSettings,
    persistChannelSetting,
    team.name)

  function verified(message) {
    if (!tokens[message.user]) {
      var id = rtmBot.activeTeamId + message.user
      dmForUserId(message.user).then(dmId => {
        rtmBot.sendMessage('You haven\'t authenticated yet, please go to ' + authUrl + '?id=' + id, dmId)
      })
      return false
    }
    return true
  }

  rtmBot.on(RTM_EVENTS.MESSAGE, function (message) {
    if (!message.text) return

    var ran
    SLACK.COMMANDS.forEach(function (command) {
      if (!ran &&
          message.text.slice(0, command.cmd.length).toLowerCase() === command.cmd.toLowerCase() &&
          command.check(message) &&
          (!command.requireUser || verified(message))) {
        ran = true
        command.run(message)
      }
    })
  })

  rtmBot.on(RTM_EVENTS.REACTION_ADDED, SLACK.REACTIONS)

  return {
    addTokenForUser: function addTokenForUser(userId, token) {
      tokens[userId] = token
      dmForUserId(webBot, dataStore, userId, dmId => {
        rtmBot.sendMessage('Nice! You are now authorized with metamaps.', dmId)
      })
    },
    addMmUserId: function addMmUserId(mmUserId, userId) {
      mmUserIds[mmUserId] = userId
    }
  }
}
module.exports.setup = setup
