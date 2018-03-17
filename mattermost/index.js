require('babel-polyfill')
require('isomorphic-fetch')
if (!global.WebSocket) {
    global.WebSocket = require('ws')
}
const Client4 = require('mattermost-redux/client/client4').default
const WsClient = require('mattermost-redux/client/websocket_client').default
const url = require('url')

// from: https://api.mattermost.com/#tag/WebSocket
const REACTION_EVENT = 'reaction_added'
const MESSAGE_EVENT = 'posted'

function transformEvent(event) {
    let parsed
    switch (event.event) {
        case MESSAGE_EVENT:
            try {
                parsed = JSON.parse(event.data.post)
                event.text = parsed.message
                event.channel = parsed.channel_id
                event.user = parsed.user_id
                event.ts = parsed.id // to match slack
            } catch (e) {}
        case REACTION_EVENT:
            try {
                parsed = JSON.parse(event.data.reaction)
                event.user = parsed.user_id
                event.reaction = parsed.emoji_name
                event.item = {
                    type: 'message',
                    ts: parsed.post_id,
                    channel: event.broadcast.channel_id
                }
            } catch (e) {}
    }
    return event
}

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

function createWsClient(webClient, connectionUrl, token, activeTeamId, activeUserId) {
  const wsClient = new WsClient()
  wsClient.initialize(token, {}, {}, {connectionUrl})
        .catch((err) => {
            console.log('error connecting to mattermost', err)
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
    wsClient.MESSAGE_EVENT = MESSAGE_EVENT
    wsClient.REACTION_EVENT = REACTION_EVENT
    wsClient.setEventCallback(event => {
        if (!event) {
            return
        }
        eventCallbacks
            .filter(ecb => ecb.type === event.event )
            .map(ecb => ecb.fn)
            .forEach(fn => fn(transformEvent(event)))
    })
    wsClient.sendM = (message, channel_id) => {
        webClient.createPost({
            message,
            channel_id
        })
    }
    wsClient.isDm = (event, cb = () => {}) => {
        cb(null, event.data.channel_type === 'D')
    }
    wsClient.getArchiveLink = (channelId, messageId) => {
        // TODO!
        return 'https://test.com'
        //const timestampWithoutDot = messageId.replace('.','')
        //return `https://${teamDomain}.slack.com/archives/${channelName}/p${timestampWithoutDot}`
    }
    wsClient.activeTeamId = activeTeamId
    wsClient.activeUserId = activeUserId
    return wsClient
}

function createDataStore(webClient, store) {
    const dataStore = {
        getChannelGroupOrDMById: () => {},
        getUserById: () => {},
        getDMByName: () => {}
    }
    return dataStore
}

function createWebApp(webClient) {
    return {
        getMessageForReaction: (reaction, cb) => {
            webClient.doFetch(
                `${webClient.getPostRoute(reaction.item.ts)}`,
                {method: 'get'})
                .then((res) => {
                    res.ts = res.id
                    res.text = res.message
                    cb(null, res)
                })
                .catch((err) => {
                    cb(err)
                })
        }
    }
}

function createWebClient(server) {
    const webClient = new Client4
    webClient.setUrl(server)

    webClient.message = (channel_id, message, cb = () => {}) => {
        webClient.createPost({channel_id, message})
            .then(res => cb(null, res))
            .catch(err => cb(err))
    }
    webClient.react = (channelId, postId, reaction, cb = () => {}) => {
        webClient.addReaction(webClient.userId, postId, reaction)
            .then(res => cb(null, res))
            .catch(err => cb(err))
    }
    webClient.dm = (userId, cb = () => {}) => {
        webClient.createDirectChannel([webClient.userId, userId])
            .then(res => cb(null, res.id))
            .catch(err => cb(err))
    }
    webClient.channelMembers = (channel_id, cb = () => {}) => {
        webClient.getChannelMembers(channel_id)
            .then(members => {
                cb(null, members.map(m => m.user_id))
            })
            .catch(err => cb(err))
    }

    return webClient
}

async function startMattermostBot(mattermost) {


    const webClient = createWebClient(mattermost.get('server'))
    try {
        const res = await webClient.login(mattermost.get('email'), mattermost.get('password'))
        webClient.setUserId(res.id)
        webClient.activeUserId = res.id
    } catch (error) {
        console.error(error)
        return null
    }
    let token = webClient.getToken()
    let host = url.parse(mattermost.get('server')).host
    const wsClient = createWsClient(
        webClient,
        `wss://${host}/api/v4/websocket`,
        token,
        mattermost._id,
        webClient.activeUserId
    )
    const dataStore = createDataStore(webClient)
    const webApp = createWebApp(webClient)

    return {
        dataStore: dataStore,
        webApp: webApp,
        webBot: webClient,
        rtmBot: wsClient
    }
}

module.exports = {
    loginAndGetUser: loginAndGetUser,
    startMattermostBot: startMattermostBot
}