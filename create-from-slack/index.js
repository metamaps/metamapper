const Promise = require('bluebird')

module.exports = function (team, setProjectMap, authUrl, METAMAPS_URL, persistChannelSetting) {

  var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
  var RtmClient = require('@slack/client').RtmClient;
  var WebClient = require('@slack/client').WebClient;
  var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
  var DataStore = require('@slack/client').MemoryDataStore;
  var dataStore = new DataStore();
  const { accessToken, tokens, mmUserIds, botToken, botId, projectMapId } = team
  var users = {};

  var web = new WebClient(accessToken); // the "App" has different (greater) permissions than the bot
  var webBot = new WebClient(botToken, {logLevel: 'info', dataStore: dataStore});
  var rtm = new RtmClient(botToken, {logLevel: 'info', dataStore: dataStore});
  rtm.start();

  function dmForUserId(userId) {
    var channel = dataStore.getDMByName(dataStore.getUserById(userId).name)
    if (channel) return Promise.resolve(channel.id)
    return webBot.dm.open(userId).then(response => response.channel.id)
  }

  function userName(userId) {
    var user = dataStore.getUserById(userId)
    return user ? user.name : null
  }

  var SLACK = require('./commands.js')(
    web,
    webBot,
    rtm,
    tokens,
    users,
    botId,
    METAMAPS_URL,
    authUrl,
    dmForUserId,
    userName,
    projectMapId,
    setProjectMap,
    team.channelSettings,
    persistChannelSetting,
    team.name);

  function verified(message) {
    if (!tokens[message.user]) {
      var id = rtm.activeTeamId + message.user
      dmForUserId(message.user).then(dmId => {
        rtm.sendMessage('You haven\'t authenticated yet, please go to ' + authUrl + '?id=' + id, dmId);
      })
      return false;
    }
    return true;
  }

  rtm.on(RTM_EVENTS.MESSAGE, function (message) {
    if (!message.text) return;

    var ran;
    SLACK.COMMANDS.forEach(function (command) {
      if (!ran &&
          message.text.slice(0, command.cmd.length).toLowerCase() === command.cmd.toLowerCase() &&
          command.check(message) &&
          (!command.requireUser || verified(message))) {
        ran = true;
        command.run(message)
      }
    });
  });

  rtm.on(RTM_EVENTS.REACTION_ADDED, SLACK.REACTIONS);

  return {
    addTokenForUser: function addTokenForUser(userId, token) {
      tokens[userId] = token;
      dmForUserId(userId).then(dmId => {
        rtm.sendMessage('Nice! You are now authorized with metamaps.', dmId)
      })
    },
    addMmUserId: function addMmUserId(mmUserId, userId) {
      mmUserIds[mmUserId] = userId
    }
  }
} // end module.exports
