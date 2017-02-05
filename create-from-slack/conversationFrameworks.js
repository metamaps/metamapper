var RTM_EVENTS = require('@slack/client').RTM_EVENTS

export const YES_ANSWERS = [
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
export const NO_ANSWERS = [
  'No',
  'Nope',
  'Nay',
  'N',
  'no',
  'nope',
  'nay',
  'n'
]

//new line
export const nl => (text) {
  return text + ' \n'
}

//bold
export const bd => (text) {
  return '*' + text + '*'
}

// instructions
export const ins => () {
  return ' (respond *yes*, *no*, or *cancel*)'
}

export const yesNoQstn => (rtm, send, question, yes, no, dontMessage) {
  if (!dontMessage) send(question + ins())
  rtm.once(RTM_EVENTS.MESSAGE, (message) => {
    if (message.channel !== dm) {
      yesNoQstn(rtm, send, question, yes, no, true)
      return
    }
    else if (YES_ANSWERS.indexOf(message.text) > -1) return yes()
    else if (NO_ANSWERS.indexOf(message.text) > -1) return no()
    else if (message.text === 'cancel') {
      send('Ok, let\'s continue the conversation later.')
    }
    else {
      yesNoQstn(rtm, send, question, yes, no, true)
    }
  })
}

export const actionTillDone => (rtm, action, done) {
  rtm.once(RTM_EVENTS.MESSAGE, (message) => {
    if (message.channel !== dm) {
      actionTillDone(action, done)
      return
    }
    else if (message.text === 'done') return done()
    else {
      action(message.text)
      actionTillDone(action, done)
    }
  })
}
