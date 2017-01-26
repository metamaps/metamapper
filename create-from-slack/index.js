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

  var web = new WebClient(token, {logLevel: 'info', dataStore: dataStore});
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


  /*
  https://api.slack.com/events/reaction_added
  {
      "type": "reaction_added",
      "user": "U024BE7LH",
      "reaction": "thumbsup",
      "item_user": "U0G9QF9C6",
      "item": {
        "type": "message",
        "channel": "C0G9QF9GZ",
        "ts": "1360782400.498405"
      },
      "event_ts": "1360782804.083113"
  }
  */
  rtm.on(RTM_EVENTS.REACTION_ADDED, function (reaction) {
    if (reaction.item.type !== 'message'
        || reaction.reaction !== 'metamap') return;

    // process the reaction
    var firstChar = reaction.item.channel.substring(0, 1);
    var endpoint
    var channel = dataStore.getChannelGroupOrDMById(reaction.item.channel)

    if (firstChar === 'C') {
      endpoint = web.channels
    } else if (firstChar === 'G') {
      endpoint = channel._modelName === 'MPDM' ? web.mpdm : web.groups
    } else if (firstChar === 'D') {
      endpoint = web.dm
    }
    endpoint.history(reaction.item.channel, {
      latest: reaction.item.ts,
      inclusive: true,
      count: 1
    }).then(resp => {
      console.log(resp)
      var message = channel.getMessageByTs(reaction.item.ts)
      console.log('msg', message)
    })
  });

  return function addTokenForUser(userId, token) {
    tokens[userId] = token;
    rtm.sendMessage('Nice! You are now authorized with metamaps.', dmForUserId(userId));
  }
} // end module.exports
