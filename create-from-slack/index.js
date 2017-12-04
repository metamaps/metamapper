const Promise = require('bluebird')
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
const RtmClient = require('@slack/client').RtmClient
const WebClient = require('@slack/client').WebClient
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const DataStore = require('@slack/client').MemoryDataStore
const { setClientsForTeam } = require('./clientsForTeam.js')
const { dmForUserId } = require('./clientHelpers.js')
const commands = require('./commands.js')

// the full url that this server is running at
const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN
const authRoute = '/sign_in'
const authUrl = fullUrl + authRoute

function setup (team, tokens, mmUserIds, channelSettings, persistChannelSetting) {
  const {
    name,
    accessToken,
    botToken,
    botId
  } = team

  // a dataStore to share between the http and websockets clients
  const dataStore = new DataStore()
  // the "App" has different (greater) permissions than the bot
  const webApp = new WebClient(accessToken)
  const webBot = new WebClient(botToken, {logLevel: 'info', dataStore: dataStore})
  const rtmBot = new RtmClient(botToken, {logLevel: 'info', dataStore: dataStore})
  // set these into memory so they can be accesible within other modules
  setClientsForTeam(name, dataStore, webApp, webBot, rtmBot)
  // this initializes the websockets slack bot
  rtmBot.start()

  const SLACK = commands(tokens, mmUserIds, botId, name, channelSettings, persistChannelSetting)

  // function for checking whether user is authenticated with metamaps or not
  // TODO: move into its own re-usable module
  function verified(message) {
    if (!tokens[message.user]) {
      var id = rtmBot.activeTeamId + message.user
      const context = {
        dataStore,
        webBot
      }
      dmForUserId(context, message.user, (err, dmId) => {
        if (err) {
          console.log(err)
          return
        }
        rtmBot.sendMessage('You haven\'t authenticated yet, please go to ' + authUrl + '?id=' + id, dmId)
      })
      return false
    }
    return true
  }

  // for every message, check whether it calls a command
  // only run one command, multiple should never be matched
  // this means that for now, the order is important
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

  // for every reaction, check whether it should perform some action
  rtmBot.on(RTM_EVENTS.REACTION_ADDED, SLACK.REACTIONS)

  return {
    addTokenForUser: function addTokenForUser(userId, token) {
      tokens[userId] = token
      const context = {
        dataStore,
        webBot
      }
      dmForUserId(context, userId, (err, dmId) => {
        if (err) {
          console.log(err)
          return
        }
        rtmBot.sendMessage('Nice! You are now authorized with metamaps.', dmId)
      })
    },
    addMmUserId: function addMmUserId(mmUserId, userId) {
      mmUserIds[mmUserId] = userId
    }
  }
}
module.exports.setup = setup
