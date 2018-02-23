const { get } = require('lodash')

module.exports = function (path, variables) {
const v = variables || {}
const participantCount = v.participantIds && v.participantIds.length
const mapUrl = process.env.METAMAPS_URL + '/maps/' + (v.linkedMap ? v.linkedMap.id : '')

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
        explain: 'What map should the session be linked to? Submit a map URL, or type or click \'new\'',
        willCreate: 'Ok. A map will be created.',
        acknowledgeMap: `Ok. Session is linked to map *${v.mapName}*.`
      },
      collectParticipants: {
        explain: 'There are two ways to select people to include in the session: \n1. Use the @ symbol and mention people\n2. Type # and then a channel name and include everyone in a channel',
        tryAgain: 'You didn\'t input a channel, nor mention anyone to include. Try again.',
        failure: 'There was an error fetching people for that channel. Try again.'
      },
      startOrCancel: {
        explain: 'The session is all set. Type `start` to begin, `restart` to reconfigure, or `cancel` to exit.',
        canceled: 'Ok, canceling this session.'
      },
      facilitatorSessionStarting: `The session is beginning. You can open the linked map here ${mapUrl}. From this chat you will be able to guide the process.
Use \`announce: [MESSAGE]\` to directly message all the participants.`,
      channelSessionStarting: `There is an ${v.sessionType} session on *${v.title}* beginning with ${participantCount} participants.
Results will be posted back here when the process is complete.`,
      participantSessionStarting: `You've been invited to an ${v.sessionType} session by <@${v.facilitator}> along with ${participantCount - 1} other participants.
They'll guide the process and be able to communicate messages to you throughout. The subject for this session is:\n*${v.title}*`,
      participantSessionDescription: `Here is the context you need:\n*${v.description}*`,
      facilitatorSessionClosed: `The session is over. Results are posted in <#${v.channelId}>.`,
      channelResults: `Here are the results from the ${v.sessionType} session on *${v.title}*, linked to map ${mapUrl}:\n`,
      participantSessionClosed:  `The session is over. Results are posted in <#${v.channelId}>.`
    },
    opinionPoll: {
      // todo: make this based on poll parameters
      participantWillStart: 'The poll is beginning. Respond agree, disagree, or pass until there are none left.',
      participantFinished: 'That\'s all of them. You will be notified when everyone has completed.'
    },
    networkMapping: {
      participantWillStart: 'The survey is beginning. Respond with a number from 0-1 that represents how well you know each person.',
      participantFinished: 'That\'s all of them. You will be notified when everyone has completed.'
    },
    buildingContext: {
      collectFocalTopic: {
        explainHasTopics: 'When the session starts, participants will be prompted to respond to a focused topic of your choice. Select one from the existing topics by typing its\' ID, or create a new one by typing it in.',
        explainNoTopics: 'When the session starts, participants will be prompted to respond to a focused topic of your choice. Create a new one by typing it in.',
      },
      collectMetacode: {
        explain: 'The participants need to know what type of response you\'re looking for. The one you choose will be assigned to all of their responses. You can change it any later time. Select a response type by typing the name',
      },
      createdTopic: 'Your response was captured.',
      participantSetTopic: `The facilitator has set a new topic to respond to\n> ${v.topicName}
\n and they are looking for responses of the type :${v.metacodeEmoji}: ${v.metacodeName}`,
      facilitatorSetTopic: 'Ok, informing participants of the new topic and response type.',
      faciliatorSetTopicError: 'There was an error picking the response type. Try `set topic` again.',
      facilitatorNoTopic: 'There is no topic with that URL or ID on the map.',
      participantUnsetTopic: 'There is no longer a topic being discussed. Please wait for the facilitator to set a new one.',
      facilitatorUnsetTopic: 'Ok, informing participants there is no longer a topic to respond to.',
      participantSetMetacode: `The facilitator is now looking for responses of type: :${v[2]}: ${v[0]}`,
      facilitatorSetMetacode: `Ok, informing participants to now respond with: :${v[2]}: ${v[0]}`,
      facilitatorNoMetacode: 'There is no metacode with that name.',
      facilitatorExplain: 'The participants have been asked to respond to your initial topic.',
      facilitatorCommands: 'The following commands can be used to steer the session\n`set topic [ID]-OR-[TOPIC_URL]-OR-[NEW_NAME]` to switch topics\n`set response type [NAME]` to switch response types\n`unset topic` to disable responses\n`end session` to close the session completely',
      participantInitialTopic: `The first topic we\'ll think about is: \n> ${v.name}`,
      participantInitialMetacode: `The facilitator is inviting :${v[2]}: ${v[0]} responses. Respond with your own ${v[0]} just by typing them in here and sending them.`,
    }
  }
}

return get(interactionText, path)
}