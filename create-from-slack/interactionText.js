const { get } = require('lodash')

module.exports = function (path, variables) {
const v = variables || {}
const participantCount = v.participantIds && v.participantIds.length

const interactionText = {
  en: {
    signedIn: {
      notSignedIn: 'Nope. You\'re not signed in to metamaps.',
      moveToDM: 'Moving to a DM to sign you in.',
      signIn: `Click here to sign in to metamaps: ${v.signInUrl}?id=${v.id}`
    },
    session: {
      moveToDM: 'Ok. Moving to a DM to set it up.',
      facilitatorOverview: `There are 4 steps to setting up a session:
1. Setting the title and details
2. Setting a channel to link the session to
3. Setting a map to link the session to
4. Choosing the participants
Let’s start.`,
      collectTitle: 'What concise title could you give to broadly define your session?',
      collectDescription: 'Now, you need to offer participants any background and context they might need to participate well in the session. Write an introductory paragraph for this which they will see.',
      collectChannel: {
        explain: 'What channel should the session be linked to? Type the `#` symbol and channels will autocomplete.',
        tryAgain: 'That\'s not a valid channel, try again.'
      },
      collectMap: {
        explain: 'What map should the session be linked to?',
        willCreate: 'Ok. That map will be created.',
        acknowledgeMap: `Ok. Session is linked to map ${v.mapName}.`
      },
      collectParticipants: {
        explain: 'Use the @ symbol to mention the people to include in the session.',
        tryAgain: 'You didn\'t mention anyone to include. Try again.'
      },
      startOrCancel: {
        explain: 'The session is all set. Type *start* to begin or *cancel* to exit.',
        canceled: 'Ok, canceling this session.'
      },
      facilitatorSessionStarting: `The session is beginning. You will be updated here with information about how people are participating, and be able to guide the process.
You can make announcements to all participants by typing “announce: “ followed by your message`,
      channelSessionStarting: `There is an ${v.sessionType} session on *${v.title}* beginning with ${participantCount} participants.
Results will be posted back here when the process is complete.`,
      participantSessionStarting: `You've been invited to an ${v.sessionType} session by <@${v.facilitator}> along with ${participantCount - 1} other participants.
They'll guide the process and be able to communicate messages to you throughout. The subject for this session is:\n*${v.title}*`,
      participantSessionDescription: `Here is the context you need:\n*${v.description}*`,
      facilitatorSessionClosed: 'The session has closed.',
      channelResults: `Here are the results from the ${v.sessionType} session on *${v.title}*:\n`
    },
    opinionPoll: {
      // todo: make this based on poll parameters
      participantWillStart: 'The poll is beginning. Respond agree, disagree, or pass until there are none left.',
      // todo: replace "original channel" with link to that channel
      participantFinished: 'That\'s all of them. Results will be posted back in the original channel when everyone has completed the poll.'
    }
  }
}

return get(interactionText, path)
}