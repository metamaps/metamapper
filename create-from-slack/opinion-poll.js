var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var Metamaps = require('./metamaps.js')
const { apply, each, eachOfSeries } = require('async')
const { dmForUserId } = require('./clientHelpers.js')
const { interactiveResponse } = require('../interactiveMessagesManager.js')

function collectResponseForTopic (context, topic, index, cb) {
  const { dm } = context
  const interactiveConfig = {
    text: topic.name,
    options: [
      { text: 'Agree', value: 1 },
      { text: 'Disagree', value: -1 },
      { text: 'Pass', value: 0 }
    ]
  }
  interactiveResponse(context, dm, interactiveConfig, cb)
}
module.exports.collectResponseForTopic = collectResponseForTopic


function collectResponsesForUser (context, userId, cb) {
  const { map: { topics } } = context
  const responses = []
  // only get the dm channel id for each user once, add it to context
  dmForUserId(context, userId, function (err, dm) {
    if (err) {
      cb(err)
      return
    }
    const newContext = Object.assign({}, context, {dm})
    function iteratee (topic, index, next) {
      collectResponseForTopic(newContext, topic, index, function (err, response) {
        if (err) {
          next(err)
          return
        }
        responses.push({
          opinion: response,
          text: topic.name,
          id: topic.id
        })
        next()
      })
    }
    function finish (err) {
      if (err) {
        // todo: should the error get bubbled up or swallowed?
        cb(err)
        return
      }
      cb(null, responses)
    }
    // collect a response for each topic from the user, one at a time
    eachOfSeries(topics, iteratee, finish)
  })
}
module.exports.collectResponsesForUser = collectResponsesForUser


function main (context, cb) {
  const { mapId, tokens, facilitatorId } = context
  const responses = []
  // only get the list of topics once, add it to context
  Metamaps.getMap(mapId, tokens[facilitatorId], function (err, map) {
    if (err) {
      cb(err)
      return
    }
    const newContext = Object.assign({}, context, {map})
    const userIds = Object.keys(tokens)
    function iteratee (userId, next) {
      collectResponsesForUser(newContext, userId, function (err, opinions) {
        if (err) {
          next(err)
          return
        }
        responses.push({
          userId,
          opinions
        })
        next()
      })
    }
    function finish (err) {
      if (err) {
        cb(err)
        return
      }
      cb(null, responses)
    }
    // collect responses from each participant in parallel
    each(userIds, iteratee, finish)
  })
}
module.exports.main = main
