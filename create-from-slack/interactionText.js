const { get } = require('lodash')

module.exports = function (path, variables) {
const v = variables || {}
const interactionText = {
  en: {
    opinionPoll: {
      initiatedInChannel: `Beginning an opinion poll of map ${v.mapId}.\nResults will be posted here when everyone has completed it.`,
      // todo: make this based on poll parameters
      participantWillStart: 'The poll is beginning. Respond agree, disagree, or pass until there are none left.',
      // todo: replace "original channel" with link to that channel
      participantFinished: 'That\'s all of them. Results will be posted back in the original channel when everyone has completed the poll.',
      responseSummary: `Here are the responses: \n${v.responses}`
    },
    collectParticipants: {
      explain: 'Use the @ symbol to mention the people to include in the survey.',
      tryAgain: 'You didn\'t mention anyone to include. Try again.'
    }
  }
}

return get(interactionText, path)
}