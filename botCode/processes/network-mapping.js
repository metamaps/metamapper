var RTM_EVENTS = require('@slack/client').RTM_EVENTS
const { apply, parallel, reduce } = require('async')
const listenInChannel = require('../listenInChannel.js')
//const { interactiveResponse } = require('../../interactiveMessagesManager.js')
const iT = require('../interactionText.js')


function configure (context, config, cb) {
  cb(null, config)
}
module.exports.configure = configure

function collectResponseForParticipant (context, total, userId, memo, participant, cb) {
  const { rtmBot, dmIds } = context
  rtmBot.sendMessage(`How well do you know <@${participant}>?`, dmIds[userId])
  function collect () {
    listenInChannel(rtmBot, dmIds[userId], function (err, message) {
      if (err) {
        cb(err)
        return
      }
      // TODO: validate response
      /*if (!) {
        rtmBot.sendMessage(iT('en.session.collectParticipants.failure'), dmIds[userId])
        collect()
        return
      }*/
      memo.push({
        relation: message.text,
        id: participant
      })
      cb(null, memo)
    })
  }
  collect()
  /*
  const interactiveConfig = {
    outerText: `${total - memo.length} remaining`,
    text: `How well do you know <@${participant}>?`, // should be name
    options: [
      { text: '1', value: '1', replaceWith: 'thanks' },
      { text: '0.75', value: '0.75', replaceWith: 'thanks' },
      { text: '0.5', value: '0.5', replaceWith: 'thanks' },
      { text: '0.25', value: '0.25', replaceWith: 'thanks' },
      { text: '0', value: '0', replaceWith: 'thanks' }
    ]
  }
  const channel = dmIds[userId]
  interactiveResponse(context, channel, interactiveConfig, function (err, response) {
    if (err) {
      cb(err)
      return
    }
    memo.push({
      relation: response,
      id: participant
    })
    cb(null, memo)
  })*/
}
module.exports.collectResponseForParticipant = collectResponseForParticipant


function main (context, configuration, cb) {
  const { rtmBot, dmIds, user } = context
  const { participantIds } = configuration
  const allButFacilitator = participantIds.filter(p => p !== user)

  // collect responses from each participant in parallel (who aren't the facilitator)
  parallel(allButFacilitator.map(userId =>
    function (finished) {
      const allButUser = participantIds.filter(p => p !== userId)
      rtmBot.sendMessage(iT('en.networkMapping.participantWillStart'), dmIds[userId])
      // collect a response for each other participant from the user, one at a time,
      // into an array using async/reduce
      reduce(
        allButUser,
        [],
        // the function to iterate with is collectResponseForParticipant
        apply(collectResponseForParticipant, context, allButUser.length, userId),
        function (err, responses) {
          if (err) {
            finished(err)
            return
          }
          rtmBot.sendMessage(iT('en.networkMapping.participantFinished'), dmIds[userId])
          finished(null, {
            userId,
            responses
          })
        }
      )
    }
  ), cb)
}
module.exports.main = main


function formatResults (results, cb) {

  /*results = results.reduce(function (memo, user) {
    user.opinions.forEach(function (o) {
      memo[o.id] = memo[o.id] || {text: o.text, values: {}}
      memo[o.id].values[user.userId] = o.opinion
    })
    return memo
  }, {})

  const formatted = Object.keys(results).map(function (topicKey) {
    const topic = results[topicKey]
    let string = topic.text + '\n'
    Object.keys(topic.values).forEach(function (userId) {
      const opinion = topic.values[userId]
      string += '  '
      if (opinion === '1') {
        string += `:white_check_mark: <@${userId}> agreed`
      } else if (opinion === '-1') {
        string += `:x: <@${userId}> disagreed`
      } else if (opinion === '0') {
        string += `:wave: <@${userId}> passed`
      }
    })
    return string
  }).join('\n')
  cb(null, formatted)*/
  cb(null, JSON.stringify(results))
}
module.exports.formatResults = formatResults
