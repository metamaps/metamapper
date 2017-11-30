if (process.env.NODE_ENV !== 'production') require('dotenv').config()
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET
const METAMAPS_CLIENT_ID = process.env.METAMAPS_CLIENT_ID
const METAMAPS_CLIENT_SECRET = process.env.METAMAPS_CLIENT_SECRET
const request = require('request')
const mongoose = require('mongoose')
const express = require('express')
const bodyParser = require('body-parser')
const path = require("path");
const app = express()
app.use(bodyParser.json())
const urlencodedParser = bodyParser.urlencoded({ extended: false })

const authRoute = '/sign_in'
const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN
const authUrl = fullUrl + authRoute
const METAMAPS_URL = process.env.METAMAPS_URL
const mmApi = require('./create-from-slack/metamaps')
const metamapsSignInUrl = METAMAPS_URL + '/oauth/authorize'
const metamapsTokenUrl = METAMAPS_URL + '/oauth/token'
const metamapsOauthRoute = '/metamaps/confirm'
const metamapsRedirectUri = fullUrl + metamapsOauthRoute
const slackTokenUrl = 'https://slack.com/api/oauth.access'
const metamapBot = require('./create-from-slack')
const { handleInteractiveResponse } = require('./interactiveMessagesManager.js')
const bots = {} // will store the bot instances that are running

// import DB models
// Teams defined which teams have been workspaces have been configured to work with Metamapper
const Team = require('./models/Team')
// Tokens store authentication info for Metamaps associated with slack user accounts !!these should get encrypted/decrypted
const Token = require('./models/Token')
// ChannelSettings store configuration options for channels
const ChannelSetting = require('./models/ChannelSetting')

// make sure that you configure the DB environment variable with a valid mongodb url
mongoose.connect(process.env.DB)

var db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function() {
  // we're connected!

  // Initialize
  Team.find(function (err, teams) {
    if (err) {
      console.log(err)
      return
    }
    teams.forEach(function (team) {
      Token.find({ team_id: team.get('team_id') }, function (err, tokens) {
        if (err) {
          console.log(err)
          return
        }
        ChannelSetting.find({ team_id: team.get('team_id') }, function (err, channelSettings) {
          if (err) {
            console.log(err)
            return
          }
          var userTokens = {}
          const mmUserIds = {}
          tokens.forEach(t => {
            if (t.get('access_token')) {
              userTokens[t.get('user_id')] = t.get('access_token')
              mmUserIds[t.get('mm_user_id')] = t.get('user_id')
            }
          })
          startBotForTeam(team, userTokens, mmUserIds, channelSettings)
        })
      })
    })
  })

  function startBotForTeam(team, tokens = {}, mmUserIds = {}, channelSettings = []) {
    const toPassIn = {
      name: team.get('team_name'),
      accessToken: team.get('access_token'),
      botToken: team.get('bot_access_token'),
      botId: team.get('bot_user_id'),
      projectMapId: team.get('project_map_id'),
      mmUserIds,
      tokens
    }

    var persistProjectMap = function (projectMapId) {
      team.project_map_id = projectMapId
      team.save()
    }

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

    bots[team.get('team_id')] = metamapBot.setup(toPassIn, persistProjectMap, authUrl, persistChannelSetting)
  }

  // This is the home route. Needs work, but provides a link for
  // adding Metamapper to your slack team
  app.get('/', function (req, res) {
    var addToSlack = `<a href="https://slack.com/oauth/authorize?&client_id=${SLACK_CLIENT_ID}&redirect_uri=${fullUrl}/slack/confirm&scope=bot,commands,channels:history,channels:read,channels:write,chat:write:bot,emoji:read,groups:history,groups:read,groups:write,im:history,im:read,im:write,links:read,links:write,mpim:history,mpim:read,mpim:write,reactions:read,reactions:write,team:read,users:read"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>`
    res.send('metamapper! ' + addToSlack)
  })


  // These two routes are simply for testing/developing the HTML pages
  app.get('/authed', function (req, res) {
    res.sendFile(path.join(__dirname+'/pages/user-authenticated.html'));
  })
  app.get('/added-to-team', function (req, res) {
    res.sendFile(path.join(__dirname+'/pages/added-to-team.html'));
  })

  // This is the route that a user navigates initially to, to verify their chat account with Metamaps
  // so it just redirects to metamaps
  app.get(authRoute, function (req, res) {
    var redirect = metamapsSignInUrl + '?client_id=' + METAMAPS_CLIENT_ID + '&response_type=code&redirect_uri=' + encodeURIComponent(metamapsRedirectUri + '?id=' + req.query.id)
    res.redirect(redirect)
  })

  // This is the route that Metamaps redirects back to once user authorizes our service to access that account
  app.get(metamapsOauthRoute, function (req, res) {
    var code = req.query.code
    var key = req.query.id
    var userId = key.substring(9)
    var teamId = key.slice(0, 9)
    var redirect_uri = process.env.PROTOCOL + '://' + process.env.DOMAIN + req.path + '?id=' + key
    // Metamaps uses the multi-step Oauth2 authorization flow
    var options = {
      uri: metamapsTokenUrl,
      form: {
        client_id: METAMAPS_CLIENT_ID,
        client_secret: METAMAPS_CLIENT_SECRET,
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      }
    }
    // make the request to Metamaps with the authorization code to get a token for the user
    request.post(options, function (err, response, body) {
      if (err) {
        console.log(err)
        return // redirect and show error
      }
      body = JSON.parse(body)
      if (!body.access_token) return res.send('There was an error')
      // Store the token for that user TODO: encrypt it!
      var token = new Token({
        access_token: body.access_token,
        key: key,
        user_id: userId,
        team_id: teamId
      })
      token.save()
      // In addition to saving it to the database, add it to the running version
      bots[teamId].addTokenForUser(userId, body.access_token)
      // At this point, we consider it successful and respond with the HTML page
      res.sendFile(path.join(__dirname+'/pages/user-authenticated.html'));
      // now just to save it in the database, we go back to the Metamaps API and fetch the user ID
      mmApi.getMyId(body.access_token, (err, id) => {
        if (err) {
          console.log('error fetching id for user')
          return
        }
        token.set('mm_user_id', id.toString())
        token.save()
        bots[teamId].addMmUserId(token.get('mm_user_id'), token.get('user_id'))
      })
    })
  })

  // This is the route that Slack redirects to in order to complete the process
  // of adding Metamapper to your team
  app.get('/slack/confirm', function (req, res) {
      var code = req.query.code
      var redirect_uri = fullUrl + req.path
      var options = {
        uri: slackTokenUrl,
        form: {
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          code: code,
          redirect_uri: redirect_uri
        }
      }
      request.post(options, function (err, response, body) {
        if (err) {
          console.log(err)
          return // redirect and show error
        }
        body = JSON.parse(body)
        // Save this new team to the DB
        var team = new Team({
          access_token: body.access_token,
          team_name: body.team_name,
          team_id: body.team_id,
          bot_user_id: body.bot.bot_user_id,
          bot_access_token: body.bot.bot_access_token
        })
        team.save()
        // boot up the bot in the new team right away
        startBotForTeam(team)
        // respond with the success "bot added to workspace" page
        res.sendFile(path.join(__dirname+'/pages/added-to-team.html'));
      })
  })


  // This is route that slack should be configured to post interactive message responses to
  app.post('/slack/interactive-messages', urlencodedParser, function (req, res) {
    res.status(200).end()
    // TODO: check verification code!
    const payload = JSON.parse(req.body.payload)  // parse URL-encoded payload JSON string
    handleInteractiveResponse(payload, res)
  })



  // This is a random endpoint that is currently being used by Robert Best
  // TODO: factor this out!
  app.post('/slack-special-endpoint-123', function (req, res) {
    /* Example slack data from nuzzel links
    { token: 'nlbSeAI84dZeYDbvlewO4Wg9',
    team_id: 'T0A76MJUV',
    api_app_id: 'A4HK6227M',
    event:
     { text: '*<http://www.ncbi.nlm.nih.gov/pubmed/24916974|Impact of home-delivered meal programs on diet and nutrition among older adults: a review. - PubMed - NCBI>*',
       bot_id: 'B4H968ARY',
       attachments: [ [

          { fallback: '256x256px image',
          image_url: 'http://www.ncbi.nlm.nih.gov/coreutils/img/pubmed256blue.png',
          image_width: 256,
          image_height: 256,
          image_bytes: 13298,
          text: '<http://ncbi.nlm.nih.gov|ncbi.nlm.nih.gov> - Zhu H - Poor diet quality and insufficient nutrient intake is of particular co cern among older adults. The Older Americans Act of 1965 authorizes home-delivered meal services to homebound individuals aged 60 years and older. The purpose of this study was…',
          pretext: 'Shared by 9 friends of <http://nuzzel.com/Bortseb|Robert Best>. View <http://nuzzel.com/story/03162017/ncbi.nlm.nih/impact_of_homedelivered_meal_programs_on_diet_and_nutrition_among?utm_campaign=alert&amputm_medium=slack&amputm_source=app&ampe=226952|comments and more info> on <http://nuzzel.com|Nuzzel>',
          id: 1 }

       ] ],
       type: 'message',
       subtype: 'bot_message',
       ts: '1489753272.735468',
       channel: 'C4HA431RS',
       event_ts: '1489753272.735468' },
    type: 'event_callback',
    authed_users: [ 'U0A76NT47' ],
    event_id: 'Ev4LH3LV2S',
    event_time: 1489753272 }

    */

    var teamId = 'T0A76MJUV'
    //channel IDs
    var torss = 'C4HA431RS'
    var commonsify_feed = 'C6SEWS5S4'
    var CryptoICT = 'C65N61U4D'


    // acknowledge that we've received the message from slack
    if (req.body.challenge) res.send(req.body.challenge)
    else res.send('ok')

    // get the data off the request
    var event = req.body.event
    var link = event.text.substr(2,event.text.length - 4).split("|")[0]
    var title = event.text.substr(2,event.text.length - 4).substr(link.length + 1)
    var nuzzelData = event.attachments[0].pretext
    var source = nuzzelData.split("|")[1].split(">")[0]

    //torss
    if (event && event.text !== null && req.body.team_id === teamId && event.channel === torss && event.subtype !== "message_changed"){
      request.post({
        url: 'https://maker.ifttt.com/trigger/torss/with/key/dDAh9bqkTvtTbfTmo6DDxL',
        form: {
          'value1': link,
          'value2': title,
          'value3': nuzzelData
        }
      })
    }

    //commonsify
    if (event && event.text !== null && req.body.team_id === teamId && event.channel === torss && source === "commonsify" && event.subtype !== "message_changed"){
      request.post({
        url: 'https://maker.ifttt.com/trigger/commonsify_feed/with/key/dDAh9bqkTvtTbfTmo6DDxL',
        form: {
          'value1': link,
          'value2': title,
          'value3': nuzzelData
        }
      })
    }

    //cryptoICT
    if (event && event.text !== null && req.body.team_id === teamId && event.channel === CryptoICT && event.subtype !== "message_changed"){
      request.post({
        url: 'https://maker.ifttt.com/trigger/CryptoICT/with/key/dsQlYVJ5ABZfQD1sZzZTrF',
        form: {
          'value1': link,
          'value2': title,
          'value3': nuzzelData
        }
      })
    }

    //futurutuf
    if (event && event.text !== null && req.body.team_id === teamId && event.channel === torss && source === "futurutuf" && event.subtype !== "message_changed"){
      request.post({
        url: 'https://maker.ifttt.com/trigger/futurutuf/with/key/dDAh9bqkTvtTbfTmo6DDxL',
        form: {
          'value1': link,
          'value2': title,
          'value3': nuzzelData
        }
      })
    }


  })

  app.listen(process.env.PORT, function () {
    console.log('Metamapper app listening on port ' + process.env.PORT)
  })
})
