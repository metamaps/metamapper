const Promise = require('bluebird')
const { setClientsForTeam } = require('./clientsForTeam.js')
const { startMattermostBot } = require('../mattermost')
const { startSlackBot } = require('../slack')
const commands = require('./commands.js')

// the full url that this server is running at
const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN
const authRoute = '/sign_in'
const authUrl = fullUrl + authRoute

async function setup (serverType, botConfig, tokens, mmUserIds, channelSettings, persistChannelSetting) {
  let name, botId, clients
  if (serverType === 'slack') {
    clients = await startSlackBot(botConfig)
    name = botConfig.get('team_name')
    botId = botConfig.get('bot_user_id')
  } else if (serverType === 'mattermost') {
    try {
      clients = await startMattermostBot(botConfig)
    } catch (e) {
      console.log('this error', e)
    }
    name = botConfig.get('server')
    botId = clients.webBot.userId
  }
  const { dataStore, webApp, webBot, rtmBot } = clients
  // set these into memory so they can be accesible within other modules
  setClientsForTeam(name, dataStore, webApp, webBot, rtmBot)

  const ACTIONS = commands(serverType, tokens, mmUserIds, botId, name, channelSettings, persistChannelSetting)

  // function for checking whether user is authenticated with metamaps or not
  // TODO: move into its own re-usable module
  function verified(message) {
    if (!tokens[message.user]) {
      const id = `${serverType}/${rtmBot.activeTeamId}/${message.user}`
      webBot.dm(message.user, (err, dmId) => {
        if (err) {
          console.log(err)
          return
        }
        rtmBot.sendM(`You haven\'t authenticated yet, please go to ${authUrl}?id=${id}`, dmId)
      })
      return false
    }
    return true
  }

  // for every message, check whether it calls a command
  // only run one command, multiple should never be matched
  // this means that for now, the order is important
  rtmBot.on(rtmBot.MESSAGE_EVENT, function (message) {
    if (!message.text) return
    let ran
    ACTIONS.COMMANDS.forEach(function (command) {
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
  rtmBot.on(rtmBot.REACTION_EVENT, ACTIONS.REACTIONS)

  return {
    addTokenForUser: function addTokenForUser(userId, token) {
      tokens[userId] = token
      webBot.dm(userId, (err, dmId) => {
        if (err) {
          console.log(err)
          return
        }
        rtmBot.sendM('Nice! You are now authorized with metamaps.', dmId)
      })
    },
    addMmUserId: function addMmUserId(mmUserId, userId) {
      mmUserIds[mmUserId] = userId
    }
  }
}
module.exports.setup = setup
