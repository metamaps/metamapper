const { get } = require('lodash')

module.exports = function (path, variables) {
const v = variables || {}
const interactionText = {
  en: {
    session: {
      acknowledgeInitiate: 'Ok. Let’s move to a DM to set it up.',
      introduce: `There are {4 + # of process specific steps} steps to setting up a session.
                  1. Setting the title and details
                  2. Setting a channel to link the survey to
                  3. Setting a map to link the survey to
                  4. { PROCESS SPECIFIC CONFIGURATION STEPS}
                  5. Choosing the participants
                  Let’s start.`,
      collectTitle: 'What concise title could you give to broadly define your session?',
      collectDescription: 'Now, we need to offer participants any background and context they might need to participate well in the session. Write an introductory paragraph for this which they will see.',
      collectChannel: 'Great. What channel should the session be linked to?',
      collectMap: 'Ok. What map should the session be linked to?',
      collectMapAcknowledge: `Ok. Session is linked to map ${v.mapName}.`,
      collectParticipants: {
        explain: 'Use the @ symbol to mention the people to include in the session.',
        tryAgain: 'You didn\'t mention anyone to include. Try again.'
      },
      sessionStarting: `The session is beginning. You will be updated here with information about how people are participating, and be able to guide the process. You can:
                        - make announcements to all participants by typing “announce: “ followed by your message
                        - close the session at any point by typing “close session” and collect whatever results are there so far`
    },
    opinionPoll: {
      initiatedInChannel: `Beginning an opinion poll of map ${v.mapId}.\nResults will be posted here when everyone has completed it.`,
      // todo: make this based on poll parameters
      participantWillStart: 'The poll is beginning. Respond agree, disagree, or pass until there are none left.',
      // todo: replace "original channel" with link to that channel
      participantFinished: 'That\'s all of them. Results will be posted back in the original channel when everyone has completed the poll.',
      responseSummary: `Here are the responses: \n${v.responses}`
    }
  }
}

return get(interactionText, path)
}