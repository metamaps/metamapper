var RTM_EVENTS = require('@slack/client').RTM_EVENTS
const { apply, parallel, reduce } = require('async')
const { interactiveResponse } = require('../../interactiveMessagesManager.js')
const iT = require('../interactionText.js')


function configure (context, config, cb) {
  cb(null, config)
}
module.exports.configure = configure

function collectResponseForTopic (context, total, userId, memo, topic, cb) {
  const { dmIds } = context
  const interactiveConfig = {
    outerText: `${total - memo.length} remaining`,
    text: topic.name,
    options: [
      { text: 'Agree', value: '1', replaceWith: ':white_check_mark: You agreed' },
      { text: 'Disagree', value: '-1', replaceWith: ':x: You disagreed' },
      { text: 'Pass', value: '0', replaceWith: ':wave: You passed' }
    ]
  }
  const channel = dmIds[userId]
  interactiveResponse(context, channel, interactiveConfig, function (err, response) {
    if (err) {
      cb(err)
      return
    }
    memo.push({
      opinion: response,
      text: topic.name,
      id: topic.id
    })
    cb(null, memo)
  })
}
module.exports.collectResponseForTopic = collectResponseForTopic


function main (context, configuration, cb) {
  const { rtmBot, dmIds } = context
  const { linkedMap: { topics }, participantIds } = configuration
  // collect responses from each participant in parallel
  parallel(participantIds.map(userId =>
    function (finished) {
      rtmBot.sendMessage(iT('en.opinionPoll.participantWillStart'), dmIds[userId])
      // collect a response for each topic from the user, one at a time,
      // into an array using async/reduce
      reduce(
        topics,
        [],
        // the function to iterate with is collectResponseForTopic
        apply(collectResponseForTopic, context, topics.length, userId),
        function (err, opinions) {
          if (err) {
            finished(err)
            return
          }
          rtmBot.sendMessage(iT('en.opinionPoll.participantFinished'), dmIds[userId])
          finished(null, {
            userId,
            opinions
          })
        }
      )
    }
  ), cb)
}
module.exports.main = main


function formatResults (results, cb) {

  results = results.reduce(function (memo, user) {
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
  cb(null, formatted)
}
module.exports.formatResults = formatResults
