const { get } = require('lodash')

module.exports = function (path, variables) {
const v = variables || {}
const interactionText = {
  en: {
    signedIn: {
      notSignedIn: 'Nope. You\'re not signed in to metamaps.',
      moveToDM: 'Moving to a DM to sign you in.',
      signIn: `Click here to sign in to metamaps: ${v.signInUrl}?id=${v.id}`
    },
    session: {
      moveToDM: 'Ok. Moving to a DM to set it up.',
      facilitatorOverview: `There are {4 + # of process specific steps} steps to setting up a session.
1. Setting the title and details
2. Setting a channel to link the session to
3. Setting a map to link the session to
4. { PROCESS SPECIFIC CONFIGURATION STEPS}
5. Choosing the participants
Let’s start.`,
      collectTitle: 'What concise title could you give to broadly define your session?',
      collectDescription: 'Now, you need to offer participants any background and context they might need to participate well in the session. Write an introductory paragraph for this which they will see.',
      collectChannel: {
        explain: 'What channel should the session be linked to? Type the `#` symbol and channels will autocomplete.',
        tryAgain: 'That\'s not a valid channel, try again.'
      },
      collectMap: 'What map should the session be linked to?',
      collectMapAcknowledge: `Ok. Session is linked to map ${v.mapName}.`,
      collectParticipants: {
        explain: 'Use the @ symbol to mention the people to include in the session.',
        tryAgain: 'You didn\'t mention anyone to include. Try again.'
      },
      facilitatorSessionStarting: `The session is beginning. You will be updated here with information about how people are participating, and be able to guide the process. You can:
- make announcements to all participants by typing “announce: “ followed by your message
- close the session at any point by typing “close session” and collect the results so far`,
      // TODO: list participants, or number of participants
      channelSessionStarting: `There is an ${v.sessionType} session on *${v.title}* beginning.
Results will be posted back here when the process is complete.`,
      participantSessionStarting: `You've been invited to an ${v.sessionType} session by <@${v.facilitator}>.
They'll guide the process and be able to communicate messages to you throughout. The subject for this session is:\n*${v.title}*`,
      participantSessionDescription: `Here is the context you need:\n*${v.description}*`
    },
    opinionPoll: {
      // todo: make this based on poll parameters
      participantWillStart: 'The poll is beginning. Respond agree, disagree, or pass until there are none left.',
      // todo: replace "original channel" with link to that channel
      participantFinished: 'That\'s all of them. Results will be posted back in the original channel when everyone has completed the poll.',
      channelResponseSummary: `Here are the responses: \n${v.responses}`
    }
  }
}

return get(interactionText, path)
}