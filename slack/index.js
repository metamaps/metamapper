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
    rtmBot.MESSAGE_EVENT = RTM_EVENTS.MESSAGE
    rtmBot.REACTION_EVENT = RTM_EVENTS.REACTION_ADDED
    
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