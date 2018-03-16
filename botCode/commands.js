const Promise = require('bluebird')
const METAMAPS_URL = process.env.METAMAPS_URL
const { getClientsForTeam } = require('./clientsForTeam')
const iT = require('./interactionText.js')
const Metamaps = require('./metamaps.js')
const session = require('./session.js')
const processes = require('./processes')

// TODO: refactor so this code is shared
// the full url that this server is running at
const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN
const authRoute = '/sign_in'
const signInUrl = fullUrl + authRoute

module.exports = function (
  tokens,
  userIds,
  botId,
  teamName,
  channelSettings,
  persistChannelSetting) {

  const clients = getClientsForTeam(teamName)
  const dataStore = clients.dataStore
  const teamWebClient = clients.webApp
  const webBot = clients.webBot
  const rtmBot = clients.rtmBot

  const getArchiveLink = (channelId, messageId) => {
    const teamDomain = rtmBot.dataStore.teams[rtmBot.activeTeamId].domain
    const channelIsh = rtmBot.dataStore.getChannelGroupOrDMById(channelId)
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

  // this is for responses
  const topicChannelPerson = {}
  const messagesTopics = {}
  const fetchTopicForMessage = (channelId, messageId, personId) => {
    // check the cache first
    if (messagesTopics[channelId + messageId]) {
      setTopicChannelPerson(channelId, personId, messagesTopics[channelId + messageId])
      return
    }
    const archiveLink = getArchiveLink(channelId, messageId)
    Metamaps.findTopicWithLink(archiveLink, tokens[personId], (err, topic) => {
      if (err || !topic) {
        if (err) console.log(err)
        setMessageChannelPerson(channelId, personId, null)
        webBot.react(channelId, messageId, 'exclamation')
        return
      }
      messagesTopics[channelId + messageId] = topic.id // add it to the cache
      if (getTopicChannelPerson(channelId, personId).message === messageId) {
        setTopicChannelPerson(channelId, personId, topic.id)
      }
    })
  }
  const getTopicChannelPerson = (channelId, personId) => {
    topicChannelPerson[channelId] = topicChannelPerson[channelId] || {}
    topicChannelPerson[channelId][personId] = topicChannelPerson[channelId][personId] || {}
    return topicChannelPerson[channelId][personId]
  }
  const setMessageChannelPerson = (channelId, personId, messageId) => {
    topicChannelPerson[channelId] = topicChannelPerson[channelId] || {}
    topicChannelPerson[channelId][personId] = {
      message: messageId
    }
    if (messageId) fetchTopicForMessage(channelId, messageId, personId)
  }
  const setTopicChannelPerson = (channelId, personId, topicId) => {
    topicChannelPerson[channelId][personId].topic = topicId
  }

  const persistChannel = channel => {
    persistChannelSetting(
      channel,
      channelSettings[channel].map,
      channelSettings[channel].metacode,
      channelSettings[channel].capture
    )
  }
  const setChannelSetting = (channel, property, value) => {
    channelSettings[channel] = channelSettings[channel] || {}
    channelSettings[channel][property] = value
    persistChannel(channel)
  }
  const getChannelSetting = (channel, property) => {
    channelSettings[channel] = channelSettings[channel] || {}
    return channelSettings[channel][property]
  }

  function postTopicsToMetamaps(topics, userId, channel, timestamp) {
    var addToMap = getChannelSetting(channel, 'map') // returns the id
    if (!addToMap) {
      rtmBot.send('There\'s no map set for this channel, use *set map*', channel)
    }
    topics.forEach(topic => {
      // first: use the metacode_id provided if there is one
      const metacodeInText = Metamaps.findMetacodeEmojiInText(topic.name)
      if (!topic.metacode_id && metacodeInText) {
        // second: use a metacode that was used in the text of the message
        topic.metacode_id = Metamaps.findMetacodeId(metacodeInText)
        topic.name = topic.name.replace(Metamaps.emojiRegex, '')
      }
      if (!topic.metacode_id) {
        // third: use the default metacode for the channel
        // fourth: use 'wildcard' as a last resort
        topic.metacode_id = getChannelSetting(channel, 'metacode')
                              || Metamaps.findMetacodeId('Wildcard')
      }

      // add link back to the message to the topic getting created
      topic.link = getArchiveLink(channel, timestamp)
      topic.defer_to_map_id = addToMap

      const emoji = Metamaps.findMetacodeEmoji(topic.metacode_id)
      Metamaps.addTopicToMap(addToMap, topic, tokens[userId], function (err, topicId, mappingId) {
        let createSynapse
        if (err == 'topic failed') {
          rtmBot.send('failed to create your topic', channel)
        } else if (err == 'mapping failed') {
          rtmBot.send('successfully created topic (id: ' + topicId + '), but failed to add it to map ' + addToMap, channel)
        } else {
          createSynapse = () => {
            const synapseInfo = getTopicChannelPerson(channel, userId)
            let synapse
            if (!synapseInfo.message) return
            if (synapseInfo.topic) {
              synapse = {
                topic1_id: synapseInfo.topic,
                topic2_id: topicId,
                category: 'from-to',
                defer_to_map_id: addToMap
              }
              Metamaps.addSynapseToMap(addToMap, synapse, tokens[userId], (err, synapseId, mappingId) => {
                if (err) {
                  console.log(err)
                  webBot.react(channel, timestamp, 'exclamation')
                }
              })
              setMessageChannelPerson(channel, userId, null) // reset
            }
            else setTimeout(() => createSynapse(), 50) // must be waiting for fetchTopicForMessage to succeed or error
          }
          createSynapse()
          console.log(channel)
          webBot.react(channel, timestamp, emoji)
            .then(() => webBot.react(channel, timestamp, 'zap'))
        }
      })
    })
  }

  function linkWithMapName(id, name) {
    return '<' + METAMAPS_URL + '/maps/' + id + '|'+ name +'>'
  }

  var COMMANDS = [
    {
      cmd: "start capture",
      variable: "",
      inHelpList: true,
      helpText: "capture every message to the map set for your current channel",
      requireUser: true,
      check: function (message) {
        return true
      },
      run: function (message) {
        if (!getChannelSetting(message.channel, 'map')) {
          rtmBot.send('You need to set a map for this channel first. Use \'set map\' or \'create map\'', message.channel)
          return
        }
        setChannelSetting(message.channel, 'capture', true)
        rtmBot.send('Ok, I will capture every message to map ' + getChannelSetting(message.channel, 'map') + ' until you type \'stop capture\'', message.channel)
      }
    },
    {
      cmd: "stop capture",
      variable: "",
      inHelpList: true,
      helpText: "stop capturing every message to the map set for your current channel",
      requireUser: true,
      check: function (message) {
        return true
      },
      run: function (message) {
        if (!getChannelSetting(message.channel, 'capture')) {
          rtmBot.send('You weren\'t capturing anywho!', message.channel)
          return
        }
        setChannelSetting(message.channel, 'capture', false)
        rtmBot.send('Ok, I\'ve stopped capturing every message to the map', message.channel)
      }
    },
    {
      cmd: "signed in?",
      variable: "",
      inHelpList: true,
      helpText: "check whether your account is connected to your metamaps account",
      requireUser: false,
      check: function (message) {
        return true
      },
      run: function (message) {
        if (tokens[message.user]) {
          rtmBot.send('Yes, you\'re signed in to metamaps.', message.channel)
        } else {
          rtmBot.send(iT('en.signedIn.notSignedIn'), message.channel)
          rtmBot.isDm(message, function (err, isDm) {
            // if not a one-on-one DM, move to one-on-one DM with that user for signing in
            if (!isDm) {
              rtmBot.send(iT('en.signedIn.moveToDM'), message.channel)
            }
            webBot.dm(message.user, function (err, dm) {
              if (err) {
                console.log(err)
                rtmBot.send('There was an error messaging you in a DM', message.channel)
                return
              }
              const iTvars = {
                signInUrl,
                id: rtmBot.activeTeamId + '/' + message.user
              }
              rtmBot.send(iT('en.signedIn.signIn', iTvars), dm)
            })
          })     
        }
      }
    },
    {
      cmd: "my maps",
      variable: " [PAGE]",
      inHelpList: true,
      helpText: "see a list of your maps",
      requireUser: true,
      check: function (message) {
        return true
      },
      run: function (message) {
        // once we have the MM user id, we can run this function
        var getMaps = (userid) => {
          var page = parseInt(message.text.substring(7)) || 1
          Metamaps.getMyMaps(userid, page, tokens[message.user], function (err, maps, pageData) {
            if (err) {
              return rtmBot.send('there was an error retrieving your maps', message.channel)
            }
            webBot.message(message.channel, Metamaps.formatMapsForDisplay(maps, pageData) + '\n')
          })
        }

        // if the MM user id is cached, use it. otherwise, find it.
        if (userIds[message.user]) {
          return getMaps(userIds[message.user])
        } else {
          Metamaps.getMyId(tokens[message.user], function (err, id) {
            if (err) {
              console.log(err)
              return
            }
            userIds[message.user] = id.toString()
            return getMaps(id.toString())
          })
        }
      }
    },
    {
      cmd: "set map ",
      variable: "[MAP_ID]",
      inHelpList: true,
      helpText: "set the map on which new topics created in that channel will appear",
      requireUser: false,
      check: function (message) {
        return true
      },
      run: function (message) {
        var id = message.text.substring(8)
        setChannelSetting(message.channel, 'map', id)

        if (!id) {
          return rtmBot.send('There was an error in setting your map. (ID Issue)', message.channel)
        }
        Metamaps.getMap(id, tokens[message.user], function (err, map) {
          if (err) {
            return rtmBot.send('There was an error in setting your map. (Fetch Issue)', message.channel)
          }
          webBot.message(message.channel, 'The current map is now set to: ' + linkWithMapName(id, map.name) + ' (ID: ' + id + ')')
        })
      }
    },
    {
      cmd: "which map",
      variable: "",
      inHelpList: true,
      helpText: "tell me which map this channel is currently set to",
      requireUser: false,
      check: function (message) {
        return true
      },
      run: function (message) {
        var id = getChannelSetting(message.channel, 'map')
        if (!id) {
          return rtmBot.send('There is no map set for this channel', message.channel)
        }
        Metamaps.getMap(id, tokens[message.user], function (err, map) {
          if (err) {
            return rtmBot.send('There was an error fetching the map for this channel', message.channel)
          }
          webBot.message(message.channel, 'The current map is ' + linkWithMapName(id, map.name) + ' (ID: ' + id + ')')
        })
      }
    },
    {
      cmd: "show map",
      variable: " [MAP_ID]",
      inHelpList: true,
      helpText: "return all the topics for a given map id in a list",
      requireUser: true,
      check: function (message) {
        return true
      },
      run: function (message) {
        var id = message.text.length > 8 ?
                   message.text.substring(9) : getChannelSetting(message.channel, 'map')
        Metamaps.getMap(id, tokens[message.user], function (err, map) {
          if (err) {
            return rtmBot.send('there was an error retrieving the map', message.channel)
          }
          webBot.message(message.channel, 'map name: ' + linkWithMapName(id, map.name) + '\n' + Metamaps.formatTopicsForDisplay(map.topics))
        })
      }
    },
    {
      cmd: "open map",
      variable: " [MAP_ID]",
      inHelpList: true,
      helpText: "return a link to open the map",
      requireUser: false,
      check: function (message) {
        return true
      },
      run: function (message) {
        var id = message.text.length > 8 ?
                   message.text.substring(9) : getChannelSetting(message.channel, 'map')
        rtmBot.send(METAMAPS_URL + '/maps/' + id, message.channel)
      }
    },
    {
      cmd: "create map ",
      variable: "[NAME_OF_MAP]",
      inHelpList: true,
      helpText: "create a map on metamaps by specifying its name",
      requireUser: true,
      check: function (message) {
        return true
      },
      run: function (message) {
        const mapName = message.text.substring(11)
        Metamaps.createMap(mapName, tokens[message.user], function (err, map) {
          if (err) {
            return rtmBot.send('there was an error creating the map', message.channel)
          }
          setChannelSetting(message.channel, 'map', map.id)
          webBot.message(message.channel, 'Channel is set to new map: ' + linkWithMapName(map.id, mapName) + ' (ID: ' + map.id + ')')
        })
      }
    },
    {
      cmd: "set metacode ",
      variable: "[METACODE_NAME]",
      inHelpList: true,
      helpText: "set the default metacode to use for the channel",
      requireUser: false,
      check: function (message) {
        return true
      },
      run: function (message) {
        var metacode_name = message.text.substring(13)
        var m = Metamaps.findMetacodeByNameIdOrEmoji(metacode_name)
        if (!m) {
          rtmBot.send(metacode_name + ' isn\'t an enabled metacode', message.channel) // list available metacodes?
          return
        }
        setChannelSetting(message.channel, 'metacode', m[1]) // the ID
        rtmBot.send('Ok, I\'ve switched the default metacode for this channel to :' + m[2] + ': *' + m[0] + '*', message.channel)
      }
    },
    {
      cmd: "mm: ",
      variable: "[TOPIC_NAME]",
      inHelpList: true,
      helpText: "use an inline metacode emoji or the default metacode for the channel or Wildcard to create a topic",
      requireUser: true,
      check: function (message) {
        return true
      },
      run: function (message) {
        var topic_name = message.text.substring(4)
        postTopicsToMetamaps([
          { name: topic_name.trim() }
        ], message.user, message.channel, message.ts)
      }
    },
    {
      cmd: "start ",
      variable: "[SESSION_TYPE]",
      inHelpList: false,
      helpText: "TODO: write this",
      requireUser: true,
      check: function (message) {
        const sessionType = message.text.substring(6).trim()
        return Object.keys(processes).indexOf(sessionType) > -1 || sessionType === 'session'
      },
      run: function (message) {
        let sessionType
        if (message.text === 'start session') {
          sessionType = 'building context'
        } else {
          sessionType = message.text.substring(6).trim()
        }
        var mapId = getChannelSetting(message.channel, 'map')
        rtmBot.isDm(message, function (err, isDm) {
          if (err) {
            // TODO: handle
          }
          const context = {
            dataStore,
            webBot: webBot,
            rtmBot: rtmBot,
            tokens,
            mapId,
            sessionType,
            user: message.user,
            channel: message.channel,
            isDm
          }
          session.run(context, function () {})
        })
      }
    },
    {
      cmd: 'help',
      variable: "",
      inHelpList: false,
      requireUser: false,
      check: function (message) {
        return true
      },
      run: function (message) {
        var help = 'Here\'s how to use metamapper:\n'
        COMMANDS.forEach(function (command) {
          if (command.inHelpList) help += '*' + command.cmd + command.variable + '* ' + command.helpText + '\n'
        })
        rtmBot.send(help, message.channel)
      }
    },
    {
      cmd: "",
      variable: "",
      inHelpList: false,
      requireUser: true,
      check: function (message) {
        return getChannelSetting(message.channel, 'capture')
      },
      run: function (message) {
        postTopicsToMetamaps([
          { name: message.text.trim() }
        ], message.user, message.channel, message.ts)
      }
    }
  ]

  /*
  https://api.slack.com/events/reaction_added
  {
      "type": "reaction_added",
      "user": "U024BE7LH",
      "reaction": "thumbsup",
      "item_user": "U0G9QF9C6",
      "item": {
        "type": "message",
        "channel": "C0G9QF9GZ",
        "ts": "1360782400.498405"
      },
      "event_ts": "1360782804.083113"
  }
  */
  const commonForReactions = reaction => {
    // process the reaction
    var firstChar = reaction.item.channel.substring(0, 1)
    var endpoint
    var channel = rtmBot.dataStore.getChannelGroupOrDMById(reaction.item.channel)

    if (firstChar === 'C') {
      endpoint = teamWebClient.channels
    } else if (firstChar === 'G') {
      endpoint = channel._modelName === 'MPDM' ? teamWebClient.mpdm : teamWebClient.groups
    } else if (firstChar === 'D') {
      endpoint = teamWebClient.dm
    }
    return endpoint.history(reaction.item.channel, {
      latest: reaction.item.ts,
      inclusive: true,
      count: 1
    }).then(resp => {
      if (!resp.ok) return Promise.reject()
      const message = resp.messages[0]
      return Promise.resolve(message)
    })
  }
  const differentReactions = [
    {
      check: reaction => Metamaps.findMetacodeId(reaction.reaction),
      run: reaction => {
        commonForReactions(reaction)
        .then(message => {
          postTopicsToMetamaps([
            { metacode_id: Metamaps.findMetacodeId(reaction.reaction), name: message.text }
          ], reaction.user, reaction.item.channel, message.ts)
        })
      }
    },
    {
      check: reaction => reaction.reaction === 'zap',
      run: reaction => {
        if (getTopicChannelPerson(reaction.item.channel, reaction.user).message === reaction.item.ts) {
          // was already set to this message, now remove it
          setMessageChannelPerson(reaction.item.channel, reaction.user, null)
        }
        else setMessageChannelPerson(reaction.item.channel, reaction.user, reaction.item.ts)
      }
    }
  ]
  const REACTIONS = reaction => {
    if (reaction.item.type !== 'message' || reaction.user === botId) return
    differentReactions.forEach(r => {
      r.check(reaction) && r.run(reaction)
    })
  }

  return {
    COMMANDS,
    REACTIONS
  }
}
