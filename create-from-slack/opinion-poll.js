var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var Metamaps = require('./metamaps.js')
const { apply, parallel, reduce } = require('async')
const { dmForUserId } = require('./clientHelpers.js')
const { interactiveResponse } = require('../interactiveMessagesManager.js')

function collectResponseForTopic (context, memo, topic, cb) {
  const { dm } = context
  const interactiveConfig = {
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
  const { topics } = context
  const responses = []
  // only get the dm channel id for each user once, add it to context
  dmForUserId(context, userId, function (err, dm) {
    if (err) {
      cb(err)
      return
    }
    const newContext = Object.assign({}, context, {dm})
    // collect a response for each topic from the user, one at a time
    reduce(topics, [], apply(collectResponseForTopic, newContext), cb)
  })
}
module.exports.collectResponsesForUser = collectResponsesForUser


function main (context, cb) {
  const { mapId, tokens, topics } = context
  const userIds = Object.keys(tokens)
  const tasks = userIds.map(function (userId) {
    return function (finished) {
      collectResponsesForUser(context, userId, function (err, opinions) {
        if (err) {
          finished(err)
          return
        }
        finished(null, {
          userId,
          opinions
        })
      })
    }
  })
  // collect responses from each participant in parallel
  parallel(tasks, cb)
}
module.exports.main = main
