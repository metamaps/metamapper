var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var Metamaps = require('./metamaps.js')
const { apply, parallel, reduce } = require('async')
const { dmForUserId } = require('./clientHelpers.js')
const { interactiveResponse } = require('../interactiveMessagesManager.js')
const interactionText = require('./interactionText.js')

function collectResponseForTopic (context, memo, topic, cb) {
  const { dm, topics } = context
  const interactiveConfig = {
    outerText: `${topics.length - memo.length} remaining`,
    text: topic.name,
    options: [
      { text: 'Agree', value: '1', replaceWith: ':white_check_mark: You agreed' },
      { text: 'Disagree', value: '-1', replaceWith: ':x: You disagreed' },
      { text: 'Pass', value: '0', replaceWith: ':wave: You passed' }
    ]
  }
  interactiveResponse(context, dm, interactiveConfig, function (err, response) {
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


function collectResponsesForUser (context, userId, cb) {
  const { topics, dm, rtmBot } = context
  rtmBot.sendMessage(interactionText('en.opinionPoll.participantWillStart'), dm)
  // collect a response for each topic from the user, one at a time
  reduce(topics, [], apply(collectResponseForTopic, context), cb)
}
module.exports.collectResponsesForUser = collectResponsesForUser


function main (context, cb) {
  const { channel, mapId, tokens, topics, rtmBot, participantIds } = context
  const iTvars = { mapId }
  rtmBot.sendMessage(interactionText('en.opinionPoll.initiatedInChannel', iTvars), channel)
  const tasks = participantIds.map(function (userId) {
    return function (finished) {
      // only get the dm channel id for each user once, add it to context
      dmForUserId(context, userId, function (err, dm) {
        if (err) {
          // cb(err)
          return
        }
        const newContext = Object.assign({}, context, {dm})
        collectResponsesForUser(newContext, userId, function (err, opinions) {
          if (err) {
            finished(err)
            return
          }
          rtmBot.sendMessage(interactionText('en.opinionPoll.participantFinished'), dm)
          finished(null, {
            userId,
            opinions
          })
        })
      })
    }
  })
  // collect responses from each participant in parallel
  parallel(tasks, function (err, opinions) {
    if (err) {
      cb(err)
      return
    }
    const iTvars = { responses: JSON.stringify(opinions) }
    rtmBot.sendMessage(interactionText('en.opinionPoll.responseSummary', iTvars), channel)
    cb(null, opinions)
  })
}
module.exports.main = main
