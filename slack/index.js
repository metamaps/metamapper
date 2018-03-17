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
    console.log(slack.get('bot_access_token'))
    console.log(slack.get('team_name'))
    // this initializes the websockets slack bot
    rtmBot.start()

    rtmBot.MESSAGE_EVENT = RTM_EVENTS.MESSAGE
    rtmBot.REACTION_EVENT = RTM_EVENTS.REACTION_ADDED
    rtmBot.send = rtmBot.sendMessage
    rtmBot.isDm = (message, cb = () => {}) => {
        const channelIsh = rtmBot.dataStore.getChannelGroupOrDMById(message.channel)
        cb(null, channelIsh._modelName === 'DM')
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