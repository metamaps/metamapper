const dataStores = {}
const webApps = {}
const webBots = {}
const rtmBots = {}

function getClientsForTeam (teamName) {
  return {
    dataStore: dataStores[teamName],
    webApp: webApps[teamName],
    webBot: webBots[teamName],
    rtmBot: rtmBots[teamName]
  }
}
module.exports.getClientsForTeam = getClientsForTeam

function setClientsForTeam (teamName, dataStore, webApp, webBot, rtmBot) {
  dataStores[teamName] = dataStore
  webApps[teamName] = webApp
  webBots[teamName] = webBot
  rtmBots[teamName] = rtmBot
}
module.exports.setClientsForTeam = setClientsForTeam