const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
const RtmClient = require('@slack/client').RtmClient
const WebClient = require('@slack/client').WebClient
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const DataStore = require('@slack/client').MemoryDataStore

async function startSlackBot(slack) {
    // a dataStore to share between the http and websockets clients
    const dataStore = new DataStore()
    // the "App" has different (greater) permissions than the bot
    const webApp = new WebClient(slack.get('access_token'))
    const webBot = new WebClient(slack.get('bot_access_token'), {logLevel: 'info', dataStore: dataStore})
    const rtmBot = new RtmClient(slack.get('bot_access_token'), {logLevel: 'info', dataStore: dataStore})
    // this initializes the websockets slack bot
    rtmBot.start()

    webApp.getMessageForReaction = (reaction, cb) => {
        // process the reaction
        const firstChar = reaction.item.channel.substring(0, 1)
        let endpoint
        const channel = dataStore.getChannelGroupOrDMById(reaction.item.channel)

        if (firstChar === 'C') {
          endpoint = webApp.channels
        } else if (firstChar === 'G') {
          endpoint = channel._modelName === 'MPDM' ? webApp.mpdm : webApp.groups
        } else if (firstChar === 'D') {
          endpoint = webApp.dm
        }
        return endpoint.history(reaction.item.channel, {
          latest: reaction.item.ts,
          inclusive: true,
          count: 1
        }).then(resp => {
          if (!resp.ok) {
              return cb(new Error('Error fetching message'))
          }
          const message = resp.messages[0]
          cb(null, message)
        })
      }

    rtmBot.MESSAGE_EVENT = RTM_EVENTS.MESSAGE
    rtmBot.REACTION_EVENT = RTM_EVENTS.REACTION_ADDED
    rtmBot.send = rtmBot.sendMessage
    rtmBot.isDm = (message, cb = () => {}) => {
        const channelIsh = rtmBot.dataStore.getChannelGroupOrDMById(message.channel)
        cb(null, channelIsh._modelName === 'DM')
    }

    rtmBot.getArchiveLink = (channelId, messageId) => {
        const teamDomain = dataStore.teams[rtmBot.activeTeamId].domain
        const channelIsh = dataStore.getChannelGroupOrDMById(channelId)
        let channelName
        if (channelIsh._modelName === 'Channel') {
          channelName = channelIsh.name
        } else if (channelIsh._modelName === 'Group' && !channelIsh.is_mpim) {
          // private channel
          channelName = channelIsh.name
        } else if (channelIsh._modelName === 'Group') {
          channelName = channelIsh.id
        } else if (channelIsh._modelName === 'DM') {
          channelName = channelIsh.id
        }
        const timestampWithoutDot = messageId.replace('.','')
        return `https://${teamDomain}.slack.com/archives/${channelName}/p${timestampWithoutDot}`
    }

    webBot.message = (channel_id, message, cb = () => {}) => {
        webBot.chat.postMessage(channel_id, message)
            .then(res => cb(null, res))
            .catch(err => cb(err))
    }
    webBot.react = (channel, timestamp, reaction, cb = () => {}) => {
        webBot.reactions.add(reaction, {channel, timestamp})
            .then(res => cb(null, res))
            .catch(err => cb(err))
    }
    webBot.dm = (userId, cb = () => {}) => {
        const channel = webBot.dataStore.getDMByName(dataStore.getUserById(userId).name)
        if (channel) {
            cb(null, channel.id)
            return
        }
        webBot.dm.open(userId)
            .then(response => cb(null, response.channel.id))
            .catch(err => cb(err))
    }
    webBot.channelMembers = (channel_id, cb = () => {}) => {
        webBot.channels.info(channel_id, function (err, info) {
            if (err) {
                cb(err)
                return
            }
            cb(null, info.channel.members)
        })
    }

    return {
        dataStore: dataStore,
        webApp: webApp,
        webBot: webBot,
        rtmBot: rtmBot
    }
}

module.exports = {
    startSlackBot: startSlackBot
}