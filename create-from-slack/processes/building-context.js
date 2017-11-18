var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var Metamaps = require('../metamaps.js')
const { apply, parallel, reduce, series } = require('async')
const { interactiveResponse } = require('../../interactiveMessagesManager.js')
const iT = require('../interactionText.js')
const listenInChannel = require('../listenInChannel.js')
const { listenInChannelTillCancel } = require('../conversationFrameworks.js')


function addTopicToMap(mapId, topic, token, cb) {
  // first: use the metacode_id provided if there is one
  const metacodeInText = Metamaps.findMetacodeEmojiInText(topic.name)
  if (!topic.metacode_id && metacodeInText) {
    // second: use a metacode that was used in the text of the message
    topic.metacode_id = Metamaps.findMetacodeId(metacodeInText)
    topic.name = topic.name.replace(Metamaps.emojiRegex, '')
  }
  if (!topic.metacode_id) {
    // third: use 'wildcard' as a last resort
    topic.metacode_id = Metamaps.findMetacodeId('Wildcard')
  }
  topic.defer_to_map_id = mapId
  const emoji = Metamaps.findMetacodeEmoji(topic.metacode_id)
  Metamaps.addTopicToMap(mapId, topic, token, function (err, topicId, mappingId) {
    if (err == 'topic failed') {
      cb('failed to create your topic')
    } else if (err == 'mapping failed') {
      cb('successfully created topic (id: ' + topicId + '), but failed to add it to map ' + mapId)
    } else {
      topic.id = topicId
      cb(null, topic)
    }
  })
}




function collectWhenTopics (context, config, cb) {
  const { rtmBot, facilitatorDM, tokens, user } = context
  const { linkedMap: { id, topics, permission } } = config
  rtmBot.sendMessage(iT('en.buildingContext.collectFocalTopic.explainHasTopics'), facilitatorDM)
  const formatted = topics.map(t => {
    const metacode = Metamaps.findMetacodeByNameIdOrEmoji(t.metacode_id)
    return `(${t.id}) :${metacode[2]}: ${t.name}\n`
  }).join('')
  rtmBot.sendMessage(formatted, facilitatorDM)
  listenInChannel(rtmBot, facilitatorDM, function (err, message) {
    if (err) {
      cb(err)
      return
    }
    const existingTopic = topics.find(t => t.id === parseInt(message.text, 10))
    if (existingTopic) {
      cb(null, existingTopic)
    } else {
      const topic = {
        name: message.text,
        permission
      }
      addTopicToMap(id, topic, tokens[user], function (err, t) {
        if (err) {
          cb(err)
          return
        }
        config.linkedMap.topics.push(t)
        cb(null, t)
      })
    }
  })
}

function collectWhenNoTopics (context, config, cb) {
  const { rtmBot, facilitatorDM, user, tokens } = context
  const { linkedMap: { id, permission } } = config
  rtmBot.sendMessage(iT('en.buildingContext.collectFocalTopic.explainNoTopics'), facilitatorDM)
  listenInChannel(rtmBot, facilitatorDM, function (err, message) {
    if (err) {
      cb(err)
      return
    }
    const topic = {
      name: message.text,
      permission
    }
    addTopicToMap(id, topic, tokens[user], function (err, t) {
      if (err) {
        cb(err)
        return
      }
      config.linkedMap.topics = [t]
      cb(null, t)
    })
  })
}

function collectFocalTopic (context, config, cb) {
  const { linkedMap: { topics } } = config

  if (topics && topics.length) {
    collectWhenTopics(context, config, cb)
  } else {
    collectWhenNoTopics(context, config, cb)
  }
}
module.exports.collectFocalTopic = collectFocalTopic


function collectMetacode (context, config, cb) {
  const { rtmBot, facilitatorDM } = context
  const metacodes = Metamaps.metacodes.map(m => `:${m[2]}: ${m[0].toLowerCase()}`)
  rtmBot.sendMessage(iT('en.buildingContext.collectMetacode.explain'), facilitatorDM)
  rtmBot.sendMessage(metacodes.join(' '), facilitatorDM)

  function collect () {
    listenInChannel(rtmBot, facilitatorDM, function (err, message) {
      if (err) {
        cb(err)
        return
      }
      const metacode = Metamaps.findMetacodeByNameIdOrEmoji(message.text)
      if (metacode) {
        cb(null, metacode)
      } else {
        rtmBot.sendMessage(iT('en.buildingContext.collectMetacode.tryAgain'), facilitatorDM)
        collect()
      }
    })
  }
  collect()
}
module.exports.collectMetacode = collectMetacode

function configure (context, config, cb) {
  series({
    focalTopic: apply(collectFocalTopic, context, config),
    starterMetacode: apply(collectMetacode, context, config)
  }, function (err, results) {
    if (err) {
      cb(err)
      return
    }
    cb(null, Object.assign({}, config, results))
  })
}
module.exports.configure = configure


function main (context, configuration, cb) {
  const { rtmBot, dmIds, facilitatorDM, tokens } = context
  const { linkedMap: { id, topics, permission } } = configuration
  const participantCancellers = []
  // track stats for this session
  const stats = {
    counts: {
      generatedTopics: 0
    }
  }
  // these are not consts because they will change as the
  // facilitator updates the session
  let { focalTopic } = configuration
  let selectedMetacode = configuration.starterMetacode

  // setup event listeners for the participants
  function handleParticipantMessage (userId, dmId, message) {
    // there is no focal topic and session is inactive
    if (!focalTopic) {
      // in this case, do nothing
      return
    }
    // there is a focal topic and session is active
    // in this case, create a topic linked to the focalTopic with the selectedMetacode!
    const topic = {
      name: message.text,
      permission,
      metacode_id: selectedMetacode[1]
    }
    addTopicToMap(id, topic, tokens[userId], function (err, t) {
      if (err) {
        rtmBot.sendMessage('There was an error creating that topic', err)
        return
      }
      rtmBot.sendMessage(iT('en.buildingContext.createdTopic'), dmId)
      stats.counts.generatedTopics += 1
      configuration.linkedMap.topics.push(t)
      // create synapse to focalTopic
      const synapse = {
        desc: '',
        topic1_id: t.id,
        topic2_id: focalTopic.id,
        category: 'from-to',
        permission,
        defer_to_map_id: id
      }
      Metamaps.addSynapseToMap(id, synapse, tokens[userId], function(err) {
        if (err) {
          // TODO: do what?
        }
      })
    })
  }
  Object.keys(dmIds).forEach(function (userId) {
    const wrappedHandler = apply(handleParticipantMessage, userId, dmIds[userId])
    const canceler = listenInChannelTillCancel(context, dmIds[userId], wrappedHandler)
    participantCancellers.push(canceler)
  })
  // setup commands and event listeners for the facilitator
  function setTopic (id) {
    const existingTopic = topics.find(t => t.id === parseInt(id, 10))
    if (existingTopic) {
      collectMetacode(context, configuration, function (err, metacode) {
        if (err) {
          rtmBot.sendMessage(iT('en.buildingContext.facilitatorSetTopicError'), facilitatorDM)
          return
        }
        rtmBot.sendMessage(iT('en.buildingContext.facilitatorSetTopic'), facilitatorDM)
        focalTopic = existingTopic
        selectedMetacode = metacode
        Object.keys(dmIds).forEach(function (userId) {
          rtmBot.sendMessage(iT('en.buildingContext.participantSetTopic', {
            topicName: focalTopic.name,
            metacodeEmoji: selectedMetacode[2],
            metacodeName: selectedMetacode[0]
          }), dmIds[userId])
        })
      })
    } else {
      rtmBot.sendMessage(iT('en.buildingContext.facilitatorNoTopic'), facilitatorDM)
    }
  }
  function setMetacode (name) {
    const metacode = Metamaps.findMetacodeByNameIdOrEmoji(name)
    if (metacode) {
      rtmBot.sendMessage(iT('en.buildingContext.facilitatorSetMetacode', metacode), facilitatorDM)
      selectedMetacode = metacode
      Object.keys(dmIds).forEach(function (userId) {
        rtmBot.sendMessage(iT('en.buildingContext.participantSetMetacode', metacode), dmIds[userId])
      })
    } else {
      rtmBot.sendMessage(iT('en.buildingContext.facilitatorNoMetacode'), facilitatorDM)
    }
  }
  function unsetTopic () {
    focalTopic = null
    rtmBot.sendMessage(iT('en.buildingContext.facilitatorUnsetTopic'), facilitatorDM)
    Object.keys(dmIds).forEach(function (userId) {
      rtmBot.sendMessage(iT('en.buildingContext.participantUnsetTopic'), dmIds[userId])
    })
  }
  function facilitatorCheckMessage (message) {
    if (message.text === 'end session') {
      end()
    } else if (message.text.startsWith('set topic ')) {
      let selectedTopic = message.text.slice(10)
      // if its a link
      if (selectedTopic.startsWith('<')) {
        let selectedTopicParts = selectedTopic
          .replace('<', '')
          .replace('>','')
          .split('/')
        selectedTopic = selectedTopicParts[selectedTopicParts.length - 1]
      }
      setTopic(selectedTopic)
    } else if (message.text.startsWith('set response type ')) {
      setMetacode(message.text.slice(18))
    } else if (message.text.startsWith('unset topic')) {
      unsetTopic()
    }
  }
  const facilitatorCancel = listenInChannelTillCancel(context, facilitatorDM, facilitatorCheckMessage)

  // offer instructions to the facilitator
  // and inform that the participants have kicked off with the initial topic and responses
  rtmBot.sendMessage(iT('en.buildingContext.facilitatorCommands'), facilitatorDM)
  rtmBot.sendMessage(iT('en.buildingContext.facilitatorExplain'), facilitatorDM)

  // offer the initial topic to the participants
  Object.keys(dmIds).forEach(function (userId) {
    rtmBot.sendMessage(iT('en.buildingContext.participantInitialTopic', focalTopic), dmIds[userId])
    rtmBot.sendMessage(iT('en.buildingContext.participantInitialMetacode', selectedMetacode), dmIds[userId])
  })

  // setup function to close out the whole process
  function end () {
    // when the process ends, close all event listeners
    facilitatorCancel()
    participantCancellers.forEach(canceler => canceler())
    cb(null, stats)
  }
}
module.exports.main = main


function formatResults (results, cb) {
  cb(null, `generated ${results.counts.generatedTopics} topics`)
}
module.exports.formatResults = formatResults
