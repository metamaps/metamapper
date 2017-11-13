const { apply, parallel, series, waterfall } = require('async')
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const listenInChannel = require('./listenInChannel.js')
const { interactiveResponse } = require('../interactiveMessagesManager.js')
const iT = require('./interactionText.js')
const Metamaps = require('./metamaps.js')
const { dmForUserId } = require('./clientHelpers.js')
const { listenInChannelTillCancel } = require('./conversationFrameworks.js')
const processes = require('./processes')


function collectTitle (context, cb) {
  const { rtmBot, facilitatorDM } = context
  rtmBot.sendMessage(iT('en.session.collectTitle'), facilitatorDM)
  listenInChannel(rtmBot, facilitatorDM, function (err, message) {
    if (err) {
      cb(err)
      return
    }
    // TODO: validate maximum length?
    cb(null, message.text)
  })
}
module.exports.collectTitle = collectTitle


function collectDescription (context, cb) {
  const { rtmBot, facilitatorDM } = context
  rtmBot.sendMessage(iT('en.session.collectDescription'), facilitatorDM)
  listenInChannel(rtmBot, facilitatorDM, function (err, message) {
    if (err) {
      cb(err)
      return
    }
    // TODO: validate it?
    cb(null, message.text)
  })
}
module.exports.collectDescription = collectDescription


function collectChannel (context, cb) {
  const { rtmBot, facilitatorDM } = context
  rtmBot.sendMessage(iT('en.session.collectChannel.explain'), facilitatorDM)
  function collect () {
    listenInChannel(rtmBot, facilitatorDM, function (err, message) {
      if (err) {
        cb(err)
        return
      }
      const idMatch = new RegExp(/<#(.*?)\|/).exec(message.text)
      const id = idMatch && idMatch[1]
      const nameMatch = new RegExp(/\|(.*?)>/).exec(message.text)
      const name = nameMatch && nameMatch[1]
      const result = {
        message: message.text,
        id,
        name
      }
      if (!result.id) {
        rtmBot.sendMessage(iT('en.session.collectChannel.tryAgain'), facilitatorDM)
        collect()
        return
      }
      cb(null, result)
    })
  }
  collect()
}
module.exports.collectChannel = collectChannel



// collectMap helper
const NEW_MAP_FLAG = 'new-map'
function getDefaultMapIfSet (mapId, token, cb) {
  if (mapId) {
    Metamaps.getMap(mapId, token, cb)
  } else {
    cb()
  }
}
// collectMap helper
function collectMapResponse (context, facilitatorDM, map, cb) {
  // the ultimate goal here is to get a map ID back from the user as a value
  // create an interactiveMessage with the default map as an option
  // TODO: add keyboard input option
  const defaultOption = map ? { text: 'Use Channel Map', value: map.id.toString(), replaceWith: 'Selected Channel Map' } : {}
  const newMapOption = { text: 'New Map with Session Title', value: NEW_MAP_FLAG, replaceWith: 'Opted to Create New Map' }
  const interactiveConfig = {
    outerText: iT('en.session.collectMap.explain'),
    text: map ? `The map set for that channel is ${map.name}` : '',
    options: map ? [defaultOption, newMapOption] : [newMapOption]
  }
  interactiveResponse(context, facilitatorDM, interactiveConfig, cb)
}
function collectMap (context, cb) {
  const { mapId, rtmBot, facilitatorDM, tokens, user } = context

  function complete (map) {
    const msg = iT('en.session.collectMap.acknowledgeMap', { mapName: map.name })
    rtmBot.sendMessage(msg, facilitatorDM)
    cb(null, map)
  }

  getDefaultMapIfSet(mapId, tokens[user], function (err, map) {
    if (err) {
      rtmBot.sendMessage('There was an error trying to fetch the default map', facilitatorDM)
    }
    collectMapResponse(context, facilitatorDM, map, function (err2, selectedMapId) {
      if (err2) {
        rtmBot.sendMessage('There was an error trying to select a map', facilitatorDM)
        // TODO: what?
      }
      if (selectedMapId === NEW_MAP_FLAG) {
        rtmBot.sendMessage(iT('en.session.collectMap.willCreate'), facilitatorDM)
        // special case, call back with just 'new-map' for map value
        // it will be created later in the flow with session title and description
        cb(null, selectedMapId)
      } else if (selectedMapId === mapId) {
        // we already have the map
        complete(map)
      } else {
        // we need to fetch the map
        Metamaps.getMap(selectedMapId, tokens[user], function (err, map) {
          if (err) {
            rtmBot.sendMessage('There was an error trying to fetch the selected map', facilitatorDM)
            cb(err)
            return
          }
          complete(map)
        })
      }
    })
  })
}
module.exports.collectMap = collectMap


function collectParticipants (context, cb) {
  // TODO: exclude the facilitator from
  // possibly being included in the participants
  const { rtmBot, facilitatorDM } = context
  rtmBot.sendMessage(iT('en.session.collectParticipants.explain'), facilitatorDM)
  // loop without re-explaining
  function collect () {
    listenInChannel(rtmBot, facilitatorDM, function (err, message) {
      if (err) {
        cb(err)
        return
      }
      const pattern = new RegExp(/<@(.*?)>/g)
      const participantIds = []
      var match = null;
      while (match = pattern.exec(message.text)) {
        participantIds.push(match[1])
      }
      if (!participantIds.length) {
        rtmBot.sendMessage(iT('en.session.collectParticipants.tryAgain'), facilitatorDM)
        collect()
        return
      }
      cb(null, participantIds)
    })
  }
  collect()
}
module.exports.collectParticipants = collectParticipants


function useOrCreateMap (context, config, cb) {
  const { rtmBot, tokens, facilitatorDM, user } = context
  if (config.linkedMap === NEW_MAP_FLAG) {
    const newMap = {
      name: config.title,
      desc: config.description
    }
    Metamaps.createMap(newMap, tokens[user], function (err, map) {
      if (err) {
        rtmBot.sendMessage('There was an error creating the map for the session', facilitatorDM)
        cb(err)
        return
      }
      cb(null, Object.assign({}, config, { linkedMap: map }))
    })
  } else {
    cb(null, config)
  }
}
module.exports.useOrCreateMap = useOrCreateMap


function startOrCancel (context, config, cb) {
  const { rtmBot, facilitatorDM } = context
  rtmBot.sendMessage(iT('en.session.startOrCancel.explain'), facilitatorDM)
  // loop without re-explaining
  function collect () {
    listenInChannel(rtmBot, facilitatorDM, function (err, message) {
      if (err) {
        cb(err)
        return
      }
      if (message.text === 'cancel') {
        rtmBot.sendMessage(iT('en.session.startOrCancel.canceled'), facilitatorDM)
        // use this special err code for early exits
        cb('canceled')
      } else if (message.text === 'start') {
        cb(null, config)
      } else collect()
    })
  }
  collect()
}
module.exports.startOrCancel = startOrCancel


function configureSession (context, cb) {
  const { rtmBot, process, facilitatorDM, sessionType, user } = context
  const config = {
    sessionType,
    facilitator: user,
    facilitatorDM
  }
  const newContext = Object.assign({}, context, { facilitatorDM })
  rtmBot.sendMessage(iT('en.session.facilitatorOverview'), facilitatorDM)
  waterfall([
      function (finished) {
        series({
          title: apply(collectTitle, newContext),
          description: apply(collectDescription, newContext),
          linkedChannel: apply(collectChannel, newContext),
          linkedMap: apply(collectMap, newContext),
          // TODO enable to also just get participants by channel
          participantIds: apply(collectParticipants, newContext)
        }, finished)
      },
      apply(useOrCreateMap, newContext),
      apply(process.configure, newContext),
      apply(startOrCancel, newContext)
  ], function (err, result) {
    if (err) {
      cb(err)
      return
    }
    cb(null, Object.assign({}, config, result))
  })
}
module.exports.configureSession = configureSession


function getDmIds (context, participantIds, cb) {
  const tasks = participantIds.map(function (userId) {
    return function (finished) {
      dmForUserId(context, userId, function (err, dm) {
        if (err) {
          finished(err)
          return
        }
        const result = {}
        result[userId] = dm
        finished(null, result)
      })
    }
  })
  parallel(tasks, function (err, dmIds) {
    if (err) {
      cb(err)
      return
    }
    // convert the many dmId objects into one object
    dmIds = dmIds.reduce(function (result, currentObject) {
      return Object.assign({}, result, currentObject)
    }, {})
    cb(null, dmIds)
  })
}


function runSession (context, configuration, cb) {
  const { process, rtmBot } = context
  const {
    facilitatorDM,
    linkedChannel,
    participantIds
  } = configuration
  const linkedChannelId = linkedChannel.id
  // TODO: show a link to the map to the facilitator
  rtmBot.sendMessage(iT('en.session.channelSessionStarting', configuration), linkedChannelId)
  rtmBot.sendMessage(iT('en.session.facilitatorSessionStarting'), facilitatorDM)
  // TODO: make sure all users have created and linked metamaps accounts
  // TODO: allow participants at any time to leave
  getDmIds(context, participantIds, function (err, dmIds) {
    if (err) {
      cb(err)
      return
    }
    // message each participant in a DM
    Object.keys(dmIds).forEach(function (userId) {
      rtmBot.sendMessage(iT('en.session.participantSessionStarting', configuration), dmIds[userId])
      rtmBot.sendMessage(iT('en.session.participantSessionDescription', configuration), dmIds[userId])
    })
    const newContext = Object.assign({}, context, { dmIds })
    function announce (message) {
      if (!message.text.startsWith('announce: ')) return
      const text = message.text.slice(10)
      Object.keys(dmIds).forEach(function (userId) {
        rtmBot.sendMessage(iT('en.session.announcement', { text }), dmIds[userId])
      })
    }
    const cancelAnnounce = listenInChannelTillCancel(context, facilitatorDM, announce)
    process.main(newContext, configuration, function (err, result) {
      if (err) {
        cb(err)
        return
      }
      cancelAnnounce()
      cb(null, configuration, result)
    })
  })
}
module.exports.runSession = runSession


function closeSession (context, configuration, result, cb) {
  const { process, rtmBot } = context
  const { facilitatorDM, linkedChannel } = configuration
  const linkedChannelId = linkedChannel.id
  rtmBot.sendMessage(iT('en.session.facilitatorSessionClosed'), facilitatorDM)
  process.formatResults(result, function (err, formatted) {
    if (err) {
      cb(err)
      return
    }
    rtmBot.sendMessage(iT('en.session.channelResults', configuration), linkedChannelId)
    rtmBot.sendMessage(formatted, linkedChannelId)
    cb(null, configuration, result)
  })
}
module.exports.runSession = runSession


function run (context, cb) {
  const { channel, dataStore, rtmBot, sessionType, user } = context
  const channelIsh = dataStore.getChannelGroupOrDMById(channel)
  // if not a one-on-one DM, move to one-on-one DM with that user for config
  if (channelIsh._modelName !== 'DM') {
    rtmBot.sendMessage(iT('en.session.moveToDM'), channel)
  }
  dmForUserId(context, user, function (err, dm) {
    if (err) {
      cb(err)
      return
    }
    const newContext = Object.assign({}, context, {
      process: processes[sessionType],
      facilitatorDM: dm
    })
    waterfall([
        apply(configureSession, newContext),
        apply(runSession, newContext),
        apply(closeSession, newContext)
    ], cb)
  })
}

module.exports.run = run