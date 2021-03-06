if (process.env.NODE_ENV !== 'production') require('dotenv').config()
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID
const mongoose = require('mongoose')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())
app.set('view engine', 'ejs')

const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN

// import DB models
// Teams defined which teams have been workspaces have been configured to work with Metamapper
const Team = require('./models/Team')
// Tokens store authentication info for Metamaps associated with slack user accounts !!these should get encrypted/decrypted
const Token = require('./models/Token')
// ChannelSettings store configuration options for channels
const ChannelSetting = require('./models/ChannelSetting')
// Mattermost are mattermost servers which have bots installed
const Mattermost = require('./models/Mattermost')

const { startBot } = require('./bots')

// pull in the routers to mount
const metamapsRouter = require('./routers/metamapsRouter')
const slackRouter = require('./routers/slackRouter')
const mattermostRouter = require('./routers/mattermostRouter')

// make sure that you configure the DB environment variable with a valid mongodb url
mongoose.connect(process.env.DB)
var db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function() {
  // we're connected to the database

  // start the express server
  app.listen(process.env.PORT, function () {
    console.log('Metamapper app listening on port ' + process.env.PORT)
  })

  // Initialize
  function startBotsForServerType (model, server_type, getRecordId) {
    model.find(function (err, records) {
      if (err) {
        console.log(err)
        return
      }
      records.forEach(function (record) {
        Token.find({ team_id: getRecordId(record), server_type }, function (err, tokens) {
          if (err) {
            console.log(err)
            return
          }
          ChannelSetting.find({ team_id: getRecordId(record), server_type }, function (err, channelSettings) {
            if (err) {
              console.log(err)
              return
            }
            const userTokens = {}
            const mmUserIds = {}
            tokens.forEach(t => {
              if (t.get('access_token')) {
                userTokens[t.get('user_id')] = t.get('access_token')
                mmUserIds[t.get('mm_user_id')] = t.get('user_id')
              }
            })
            startBot(server_type, record, userTokens, mmUserIds, channelSettings)
          })
        })
      })
    })
  }

  const serverTypes = [
    [Team, 'slack', r => r.get('team_id')],
    [Mattermost, 'mattermost', r => r._id]
  ]
  serverTypes.forEach(serverType => {
    startBotsForServerType(serverType[0], serverType[1], serverType[2])
  })
})


app.get('/', function (req, res) {
  var addToSlack = `<a class="slackButton" href="https://slack.com/oauth/authorize?&client_id=${SLACK_CLIENT_ID}&redirect_uri=${fullUrl}/slack/confirm&scope=bot,commands,channels:history,channels:read,channels:write,chat:write:bot,emoji:read,groups:history,groups:read,groups:write,im:history,im:read,im:write,links:read,links:write,mpim:history,mpim:read,mpim:write,reactions:read,reactions:write,team:read,users:read"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>`
  res.render('pages/index', { addToSlack })
})
app.use(metamapsRouter)
app.use(slackRouter)
app.use(mattermostRouter)
app.use(addonsRouter)