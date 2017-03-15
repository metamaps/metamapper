if (process.env.NODE_ENV !== 'production') require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser')
var MetaInspector = require('minimal-metainspector');
var app = express();
app.use(bodyParser.json())
var authRoute = '/sign_in';
var authUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN + authRoute;
var METAMAPS_URL = process.env.METAMAPS_URL;
const mmApi = require('./create-from-slack/metamaps')(METAMAPS_URL)
var metamapsSignInUrl = METAMAPS_URL + '/oauth/authorize';
var metamapsTokenUrl = METAMAPS_URL + '/oauth/token';
var metamapsOauthRoute = '/metamaps/confirm';
var metamapsRedirectUri = process.env.PROTOCOL + '://' + process.env.DOMAIN + metamapsOauthRoute;
var slackTokenUrl = 'https://slack.com/api/oauth.access';
var request = require('request');
var mongoose = require('mongoose');
var metamapBot = require('./create-from-slack');
var bots = {}; // will store the bot instances that are running
mongoose.connect(process.env.DB);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
// we're connected!

var Team = mongoose.model('Team', {
  access_token: String,
  team_name: String,
  team_id: String,
  bot_user_id: String,
  bot_access_token: String,
  project_map_id: String
});
var Token = mongoose.model('Token', {
  access_token: String,
  key: String,
  mm_user_id: String,
  user_id: String,
  team_id: String
});
var ChannelSetting = mongoose.model('ChannelSetting', {
  metacode_id: Number,
  map_id: String,
  capture: Boolean, // whether to capture every message or not
  channel_id: String,
  team_id: String
});

// Initialize
Team.find(function (err, teams) {
  if (err) {
    console.log(err);
    return;
  }
  teams.forEach(function (team) {
    Token.find({ team_id: team.get('team_id') }, function (err, tokens) {
      if (err) {
        console.log(err);
        return;
      }
      ChannelSetting.find({ team_id: team.get('team_id') }, function (err, channelSettings) {
        if (err) {
          console.log(err);
          return;
        }
        var userTokens = {};
        const mmUserIds = {}
        tokens.forEach(t => {
          if (t.get('access_token')) {
            userTokens[t.get('user_id')] = t.get('access_token')
            mmUserIds[t.get('mm_user_id')] = t.get('user_id')
          }
        })
        startBotForTeam(team, userTokens, mmUserIds, channelSettings)
      });
    });
  });
});

function startBotForTeam(team, tokens = {}, mmUserIds = {}, channelSettings = []) {
  const toPassIn = {
    name: team.get('team_name'),
    accessToken: team.get('access_token'),
    botToken: team.get('bot_access_token'),
    botId: team.get('bot_user_id'),
    projectMapId: team.get('project_map_id'),
    mmUserIds,
    tokens
  };

  var persistProjectMap = function (projectMapId) {
    team.project_map_id = projectMapId
    team.save()
  };

  toPassIn.channelSettings = {}
  channelSettings.forEach(function (cS) {
    toPassIn.channelSettings[cS.get('channel_id')] = {
      map: cS.get('map_id'),
      metacode: cS.get('metacode_id'),
      capture: cS.capture
    }
  })
  var persistChannelSetting = function (channelId, mapId, metacodeId, capture) {
    var channelSetting = channelSettings.find(cS => cS.get('channel_id') === channelId)
    if (!channelSetting) {
      channelSetting = new ChannelSetting({
        channel_id: channelId,
        team_id: team.get('team_id')
      })
      channelSettings.push(channelSetting)
    }
    channelSetting.capture = capture
    channelSetting.map_id = mapId
    channelSetting.metacode_id = metacodeId
    channelSetting.save()
  }

  bots[team.get('team_id')] = metamapBot(toPassIn, persistProjectMap, authUrl, METAMAPS_URL, persistChannelSetting); // returns the addTokenForUser function
}

app.get('/', function (req, res) {
  res.send('metamapper! <a href="https://slack.com/oauth/authorize?scope=bot,im:history,mpim:history,groups:history,channels:history&client_id=3623920013.22798462514&redirect_uri=' + process.env.PROTOCOL + '://' + process.env.DOMAIN + '/slack/confirm"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>');
});

app.get(authRoute, function (req, res) {
  var redirect = metamapsSignInUrl + '?client_id=' + process.env.METAMAPS_CLIENT_ID + '&response_type=code&redirect_uri=' + encodeURIComponent(metamapsRedirectUri + '?id=' + req.query.id);
  res.redirect(redirect);
});
app.get(metamapsOauthRoute, function (req, res) {
    var code = req.query.code;
    var key = req.query.id;
    var userId = key.substring(9);
    var teamId = key.slice(0, 9);
    var redirect_uri = process.env.PROTOCOL + '://' + process.env.DOMAIN + req.path + '?id=' + key;
    var options = {
      uri: metamapsTokenUrl,
      form: {
        client_id: process.env.METAMAPS_CLIENT_ID,
        client_secret: process.env.METAMAPS_CLIENT_SECRET,
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      }
    };
    request.post(options, function (err, response, body) {
      if (err) {
        console.log(err);
        return; // redirect and show error
      }
      body = JSON.parse(body);
      if (!body.access_token) return res.send('There was an error');
      var token = new Token({
        access_token: body.access_token,
        key: key,
        user_id: userId,
        team_id: teamId
      });
      token.save();
      bots[teamId].addTokenForUser(userId, body.access_token)
      res.send('ok, you can now make use of metamapper authenticated as yourself!'); // do a redirect here
      mmApi.getMyId(body.access_token, (err, id) => {
        if (err) {
          console.log('error fetching id for user')
          return
        }
        token.set('mm_user_id', id.toString())
        token.save()
        bots[teamId].addMmUserId(token.get('mm_user_id'), token.get('user_id'))
      })
    });

});

app.get('/slack/confirm', function (req, res) {
    var code = req.query.code
    var redirect_uri = process.env.PROTOCOL + '://' + process.env.DOMAIN + req.path
    var options = {
      uri: slackTokenUrl,
      form: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code: code,
        redirect_uri: redirect_uri
      }
    };

    request.post(options, function (err, response, body) {
      if (err) {
        console.log(err);
        return; // redirect and show error
      }
      body = JSON.parse(body);
      var team = new Team({
        access_token: body.access_token,
        team_name: body.team_name,
        team_id: body.team_id,
        bot_user_id: body.bot.bot_user_id,
        bot_access_token: body.bot.bot_access_token
      });
      team.save();
      startBotForTeam(team);
      res.send('ok, the metamapper has been added for your team'); // do a redirect here
    });
});

app.post('/slack-special-endpoint-123', function (req, res) {
  var teamId = 'T0A76MJUV'
  var channelId = 'C4HA431RS'

  // acknowledge that we've received the message from slack
  if (req.body.challenge) res.send(req.body.challenge)
  else res.send('ok')

  console.log(req.body)

  // get the data off the request
  var event = req.body.event

  if (event && event.text !== null && req.body.team_id === teamId && event.channel === channelId && event.subtype !== "message_changed"){

    var link = event.text.substr(2,event.text.length - 4).split("|")[0]
    var title = event.text.substr(2,event.text.length - 4).split("|")[1]

    var urlRegEx = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/

    if(urlRegEx.test(link)){
      var client = new MetaInspector(link, {});

      client.on("fetch", function(){
        // send the data through to IFTTT
        var options = {
          url: 'https://maker.ifttt.com/trigger/rss3/with/key/dDAh9bqkTvtTbfTmo6DDxL',
          form: {
            'value1': link,
            'value2': client.title,
            'value3': title
          }
        }
        console.log(options)
        request.post(options)
      });

      client.fetch();
    }
    else{
      var options = {
        url: 'https://maker.ifttt.com/trigger/rss3/with/key/dDAh9bqkTvtTbfTmo6DDxL',
        form: {
          'value1': event.text,
          'value2': "",
          'value3': ""
        }
      }
      console.log(options)
      request.post(options)
    }
  }
});

app.listen(process.env.PORT, function () {
  console.log('Metamapper app listening on port ' + process.env.PORT);
});


});
