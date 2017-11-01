var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var Metamaps = require('./metamaps.js')
const { apply, parallel, reduce } = require('async')
const { dmForUserId } = require('./clientHelpers.js')
const { interactiveResponse } = require('../interactiveMessagesManager.js')
const interactionText = require('./interactionText.js')


function configure (context, cb) {

}

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


function collectResponsesForUser (context, topics, userId, cb) {
  const { dmIds, rtmBot } = context



}
module.exports.collectResponsesForUser = collectResponsesForUser


function main (context, configuration, cb) {
  const { rtmBot, dmIds } = context
  const { linkedMap: { topics }, participantIds } = configuration
  // collect responses from each participant in parallel
  parallel(participantIds.map(userId =>
    function (finished) {
      rtmBot.sendMessage(interactionText('en.opinionPoll.participantWillStart'), dmIds[userId])
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
          rtmBot.sendMessage(interactionText('en.opinionPoll.participantFinished'), dmIds[userId])
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
  const iTvars = { responses: JSON.stringify(results) }
  cb(null, interactionText('en.opinionPoll.channelResponseSummary', iTvars))
}
module.exports.formatResults = formatResults
