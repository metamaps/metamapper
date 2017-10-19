function dmForUserId (context, userId, cb) {
  const { dataStore, webBot } = context
  var channel = dataStore.getDMByName(dataStore.getUserById(userId).name)
  if (channel) {
    cb(null, channel.id)
    return
  }
  webBot.dm.open(userId)
    .then(response => cb(null, response.channel.id))
    .catch(err => cb(err))
}
module.exports.dmForUserId = dmForUserId


function userNameForUserId (context, userId) {
  const { dataStore } = context
  var user = dataStore.getUserById(userId)
  return user ? user.name : null
}
module.exports.userNameForUserId = userNameForUserId