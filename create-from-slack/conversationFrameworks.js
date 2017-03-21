var RTM_EVENTS = require('@slack/client').RTM_EVENTS

const YES_ANSWERS = module.exports.YES_ANSWERS = [
  'Yes',
  'Yep',
  'Ya',
  'Si',
  'Y',
  'yes',
  'yep',
  'ya',
  'si',
  'y'
]

const NO_ANSWERS = module.exports.NO_ANSWERS = [
  'No',
  'Nope',
  'Nay',
  'N',
  'no',
  'nope',
  'nay',
  'n'
]

const nl = module.exports.nl = (text) => {
  return text + ' \n'
}

const bold = module.exports.bold = (text) => {
  return '*' + text + '*'
}

const instructions = module.exports.instructions = () => {
  return ' (respond *yes*, *no*, or *cancel*)'
}

const yesNoQstn = module.exports.yesNoQstn = (rtm, channel, question, yes, no, dontMessage) => {
  function send(text) {
    rtm.sendMessage(text, channel)
  }
  if (!dontMessage) send(question + instructions())
  rtm.once(RTM_EVENTS.MESSAGE, (message) => {
    if (message.channel !== channel) {
      yesNoQstn(rtm, channel, question, yes, no, true)
      return
    }
    else if (YES_ANSWERS.indexOf(message.text) > -1) return yes()
    else if (NO_ANSWERS.indexOf(message.text) > -1) return no()
    else if (message.text === 'cancel') {
      send('Ok, let\'s continue the conversation later.')
    }
    else {
      send('I don\'t quite follow you. Provide a clearer answer?')
      yesNoQstn(rtm, channel, question, yes, no, true)
    }
  })
}

const actionTillDone = module.exports.actionTillDone = (rtm, channel, action, done) => {
  rtm.once(RTM_EVENTS.MESSAGE, (message) => {
    if (message.channel !== channel) {
      actionTillDone(rtm, channel, action, done)
      return
    }
    else if (message.text === 'done') return done()
    else {
      action(message)
      actionTillDone(rtm, channel, action, done)
    }
  })
}
