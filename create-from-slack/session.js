const { apply, parallel, series, waterfall } = require('async')
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const iT = require('./interactionText.js')
const Metamaps = require('./metamaps.js')
const { dmForUserId } = require('./clientHelpers.js')

const processes = {
  'opinion poll': require('./opinion-poll.js')
}

function listenInChannel (rtmBot, channel, cb) {
  rtmBot.once(RTM_EVENTS.MESSAGE, function (message) {
    if (message.channel === channel) {
      cb(null, message)
    } else {
      listenInChannel(rtmBot, channel, cb)
    }
  })
}


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


function collectMap (context, cb) {
  const { rtmBot, facilitatorDM, tokens, user } = context
  rtmBot.sendMessage(iT('en.session.collectMap'), facilitatorDM)
  listenInChannel(rtmBot, facilitatorDM, function (err, message) {
    if (err) {
      cb(err)
      return
    }
    //
    // TODO: validate it?
    // TODO: use the InteractiveMessage
    // TODO: also allow automated creation of map
    Metamaps.getMap(message.text, tokens[user], function (err, map) {
      if (err) {
        // TODO: do what?
      }
      const msg = iT('en.session.collectMapAcknowledge', { mapName: map.name })
      rtmBot.sendMessage(msg, facilitatorDM)
      cb(null, map)
    })
  })
}
module.exports.collectMap = collectMap


function collectProcessSpecificConfig (context, cb) {
  const { rtmBot, process, facilitatorDM } = context

  cb(null, {})
}
module.exports.collectProcessSpecificConfig = collectProcessSpecificConfig


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


function configureSession (context, facilitatorDM, cb) {
  const { channel, dataStore, process, rtmBot, sessionType, user } = context
  const config = {
    sessionType,
    facilitator: user,
    facilitatorDM
  }
  const newContext = Object.assign({}, context, { facilitatorDM })
  rtmBot.sendMessage(iT('en.session.facilitatorOverview'), facilitatorDM)
  series({
    title: apply(collectTitle, newContext),
    description: apply(collectDescription, newContext),
    linkedChannel: apply(collectChannel, newContext),
    linkedMap: apply(collectMap, newContext),
    processConfig: apply(collectProcessSpecificConfig, newContext),
    participantIds: apply(collectParticipants, newContext)
  }, function (err, result) {
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
    process.main(newContext, configuration, function (err, result) {
      if (err) {
        cb(err)
        return
      }
      cb(null, configuration, result)
    })
  })
}
module.exports.runSession = runSession


function closeSession (context, configuration, result, cb) {
  const { process, rtmBot } = context
  const { facilitatorDM, linkedChannel } = configuration
  const linkedChannelId = linkedChannel.id
  rtmBot.sendMessage('session closed', facilitatorDM)
  process.formatResults(result, function (err, formatted) {
    if (err) {
      cb(err)
      return
    }
    // display results of the session in channel
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

  const process = processes[sessionType]
  const newContext = Object.assign({}, context, { process })
  waterfall([
      apply(dmForUserId, newContext, user),
      apply(configureSession, newContext),
      apply(runSession, newContext),
      apply(closeSession, newContext)
  ], cb)
}

module.exports.run = run