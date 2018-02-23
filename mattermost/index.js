require('babel-polyfill')
require('isomorphic-fetch')
if (!global.WebSocket) {
    global.WebSocket = require('ws')
}
const configureServiceStore = require('mattermost-redux/store').default
const Client4 = require('mattermost-redux/client/client4').default
const WsClient = require('mattermost-redux/client/websocket_client').default
const url = require('url')
const { clone } = require('lodash')

async function loginAndGetUser(server, username, password) {
    const mattermostClient = new Client4
    mattermostClient.setUrl(server)
    try {
        await mattermostClient.login(username, password)
    } catch (error) {
        console.error(error)
        return null
    }

    let user;
    try {
        user = await mattermostClient.getMe()
    } catch (error) {
        console.error(error)
        return null
    }

    return user
}

async function startMattermostBot(mattermost) {
    const webClient = new Client4
    const wsClient = clone(WsClient)
    webClient.setUrl(mattermost.get('server'))
    try {
        await webClient.login(mattermost.get('email'), mattermost.get('password'))
    } catch (error) {
        console.error(error)
        return null
    }
    let token = webClient.getToken()
    let host = url.parse(mattermost.get('server')).host
    //const store = configureServiceStore({}, {}, {})
    wsClient.initialize(token, {}, {}, {connectionUrl: `wss://${host}/api/v4/websocket`})
    wsClient.setErrorCallback(function (error) {
        console.log(error)
    })
    let eventCallbacks = []
    wsClient.on = (type, callback) => {
        eventCallbacks.push({
            type: type,
            fn: callback
        })
    }
    wsClient.once = (type, callback) => {
        const id = Math.random()
        eventCallbacks.push({
            type: type,
            id: id,
            fn: function (event) {
                callback(event)
                eventCallbacks = eventCallbacks.filter(ecb => ecb.id !== id)
            }
        })
    }
    // from: https://api.mattermost.com/#tag/WebSocket
    wsClient.MESSAGE_EVENT = 'posted'
    wsClient.REACTION_EVENT = 'reaction_added'
    wsClient.setEventCallback(event => {
        eventCallbacks
            .filter(ecb => ecb.type === event.event )
            .map(ecb => ecb.fn)
            .forEach(fn => fn(event))
    })
    wsClient.sendMessage = (message, channel_id) => {
        webClient.createPost({
            message,
            channel_id
        })
    }
    return {
        dataStore: null,
        webApp: null,
        webBot: null,
        rtmBot: wsClient
    }
}

module.exports = {
    loginAndGetUser: loginAndGetUser,
    startMattermostBot: startMattermostBot
}