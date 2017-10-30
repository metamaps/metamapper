const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const interactionText = require('./interactionText.js')

function collectParticipants (context, cb) {
  const { rtmBot, channel } = context
  rtmBot.sendMessage(interactionText('en.collectParticipants.explain'), channel)
  rtmBot.once(RTM_EVENTS.MESSAGE, function (message) {
    const pattern = new RegExp(/<@(.*?)>/g)
    const participantIds = []
    var match = null;
    while (match = pattern.exec(message.text)) {
      participantIds.push(match[1])
    }
    if (!participantIds.length) {
      rtmBot.sendMessage(interactionText('en.collectParticipants.tryAgain'), channel)
      collectParticipants(context, cb)
      return
    }
    cb(null, participantIds)
  })
}

module.exports = collectParticipants