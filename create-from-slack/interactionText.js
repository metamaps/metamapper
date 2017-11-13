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
      announcement: `:loudspeaker: _facilitator announcement_ \n> ${v.text}`,
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
    },
    buildingContext: {
      collectFocalTopic: {
        explainHasTopics: 'When the session starts, participants will be prompted to respond to a focused topic of your choice. Select one from the existing topics by typing its\' ID, or create a new one by typing it in. If creating one, include a metacode emoji to assign a metacode.',
        explainNoTopics: 'When the session starts, participants will be prompted to respond to a focused topic of your choice. Create a new one by typing it in. Include a metacode emoji to assign a metacode.',
      },
      collectMetacode: {
        explain: 'The participants need to know what type of response you\'re looking for. The one you choose will be assigned to all of their responses. You can change it any later time. Select a response type by typing the name',
      },
      createdTopic: 'Your response was captured.',
      participantSetTopic: `The facilitator has set a new topic to respond to\n> ${v.name}`,
      facilitatorSetTopic: 'Ok, participants know that their responses will now be related to this topic.',
      facilitatorNoTopic: 'There is no topic with that id',
      participantUnsetTopic: 'There is no longer a topic being discussed. Please wait for the facilitator to set a new one.',
      facilitatorUnsetTopic: 'Ok, participants will not be able to respond to any topic at the moment.',
      participantSetMetacode: `The facilitator has set a new response type: :${v[2]}: ${v[0]}`,
      facilitatorSetMetacode: `Ok, participants know that the set response type is now: :${v[2]}: ${v[0]}`,
      facilitatorNoMetacode: 'There is no metacode with that name',
      facilitatorExplain: 'The participants have been setup responding to your initial topic.',
      facilitatorCommands: 'The following commands are available during the session\n`set topic [ID]` to switch topics\n`set response metacode [NAME]` to switch response types\n`unset topic` to disable responses\n`end session` to close the session completely',
      participantInitialTopic: `The first topic we\'ll think about is: \n> ${v.name}`,
      participantInitialMetacode: `The facilitator is inviting :${v[2]}: ${v[0]} responses. Respond with your own ${v[0]} just by typing them in here and sending them.`
    }
  }
}

return get(interactionText, path)
}