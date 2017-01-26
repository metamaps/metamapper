module.exports = function (team, projectMapId, setProjectMap, dbTokens, authUrl, METAMAPS_URL, persistToken) {

var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RtmClient = require('@slack/client').RtmClient;
var WebClient = require('@slack/client').WebClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var DataStore = require('@slack/client').MemoryDataStore;
var dataStore = new DataStore();
var tokens = dbTokens;
var users = {};
var token = team.bot_access_token;
var botId = team.bot_user_id;

var web = new WebClient(token);
var rtm = new RtmClient(token, {logLevel: 'info', dataStore: dataStore});
rtm.start();

function dmForUserId(userId) {
  var channel = dataStore.getDMByName(dataStore.getUserById(userId).name).id;
  return channel;
}

function userName(userId) {
  var user = dataStore.getUserById(userId)
  return user ? user.name : null
}

var COMMANDS = require('./commands.js')(web, rtm, tokens, users, persistToken, botId, METAMAPS_URL, authUrl, dmForUserId, userName, projectMapId, setProjectMap, team.name);

function verified(message) {
  if (!tokens[message.user]) {
    var id = rtm.activeTeamId + message.user;
    rtm.sendMessage('You haven\'t authenticated yet, please go to ' + authUrl + '?id=' + id, dmForUserId(message.user));
    return false;
  }
  return true;
}

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
  if (!message.text) return;

  var ran;
  COMMANDS.forEach(function (command) {
    if (!ran &&
        message.text.slice(0, command.cmd.length) === command.cmd &&
        command.check(message) &&
        (!command.requireUser || verified(message))) {
      ran = true;
      command.run(message);
    }
  });
});

  return function addTokenForUser(userId, token) {
    tokens[userId] = token;
    rtm.sendMessage('Nice! You are now authorized with metamaps.', dmForUserId(userId));
  }
} // end module.exports
