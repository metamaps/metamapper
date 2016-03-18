require('dotenv').config();
var express = require('express');
var app = express();
var authRoute = '/sign_in';
var authUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN + authRoute;
var metamapsSignInUrl = process.env.METAMAPS_URL + '/oauth/authorize';
var metamapsTokenUrl = process.env.METAMAPS_URL + '/oauth/token';
var metamapsOauthRoute = '/metamaps/confirm';
var metamapsRedirectUri = process.env.PROTOCOL + '://' + process.env.DOMAIN + metamapsOauthRoute;
var slackTokenUrl = 'https://slack.com/api/oauth.access';
var request = require('request');
var mongoose = require('mongoose');
var metamapBot = function () {}; //require('slacker');
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
  bot_access_token: String
});
var Token = mongoose.model('Token', { 
  access_token: String,
  user: String
});

Team.find(function (err, teams) {
  if (err) {
    console.log(err);
    return;
  }
  teams.forEach(startBotForTeam);
});

function startBotForTeam(team) {
 metamapBot(team, Token, authUrl); 
}

app.get('/', function (req, res) {
  res.send('metamapper! <a href="https://slack.com/oauth/authorize?scope=bot&client_id=3623920013.22798462514&redirect_uri=http://localhost:9000/slack/confirm"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>');
});

app.get(authRoute, function (req, res) {
  var redirect = metamapsSignInUrl + '?client_id=' + process.env.METAMAPS_CLIENT_ID + '&response_type=code&redirect_uri=' + encodeURIComponent(metamapsRedirectUri + '?id=' + req.query.id);
  res.redirect(redirect);
});
app.get(metamapsOauthRoute, function (req, res) {
    var code = req.query.code;
    var userId = req.query.id;
    var redirect_uri = process.env.PROTOCOL + '://' + process.env.DOMAIN + req.path
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
      var token = new Token({ 
        access_token: body.access_token,
        user: userId
      });
      token.save();
      res.send('ok, you can now make use of metamapper authenticated as yourself!'); // do a redirect here
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

app.listen(process.env.PORT, function () {
  console.log('Metamapper app listening on port ' + process.env.PORT);
});


});
