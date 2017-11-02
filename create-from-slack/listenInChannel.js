const RTM_EVENTS = require('@slack/client').RTM_EVENTS

function listenInChannel (rtmBot, channel, cb) {
  rtmBot.once(RTM_EVENTS.MESSAGE, function (message) {
    if (message.text && message.channel === channel && message.user !== rtmBot.activeUserId) {
      cb(null, message)
    } else {
      listenInChannel(rtmBot, channel, cb)
    }
  })
}
module.exports = listenInChannel