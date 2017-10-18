var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var Metamaps = require('./metamaps.js')
const { apply, parallel, reduce } = require('async')
const { dmForUserId } = require('./clientHelpers.js')
const { interactiveResponse } = require('../interactiveMessagesManager.js')

const interactionText = {
  // todo: make this based on poll parameters
  participantWillStartPoll: "The poll is beginning. Respond agree, disagree, or pass until there are none left.",
  // todo: replace "original channel" with link to that channel
  participantFinishedPoll: "That\'s all of them. Results will be posted back in the original channel when everyone has completed the poll."
}

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
  rtmBot.sendMessage(interactionText.participantWillStartPoll, dm)
  // collect a response for each topic from the user, one at a time
  reduce(topics, [], apply(collectResponseForTopic, context), cb)
}
module.exports.collectResponsesForUser = collectResponsesForUser


function main (context, cb) {
  const { mapId, tokens, topics, rtmBot, who } = context
  //const userIds = Object.keys(tokens)
  // todo: ask for participants
  const userIds = [who]
  const tasks = userIds.map(function (userId) {
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
          rtmBot.sendMessage(interactionText.participantFinishedPoll, dm)
          finished(null, {
            userId,
            opinions
          })
        })
      })
    }
  })
  // collect responses from each participant in parallel
  parallel(tasks, cb)
}
module.exports.main = main
