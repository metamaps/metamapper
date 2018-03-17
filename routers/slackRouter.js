const bodyParser = require('body-parser')
const request = require('request')
const path = require("path")
const express = require('express')
const router = express.Router()
const urlencodedParser = bodyParser.urlencoded({ extended: false })

const { handleInteractiveResponse } = require('../interactiveMessagesManager.js')
const Team = require('../models/Team')
const { startBot } = require('../bots')

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET
const slackTokenUrl = 'https://slack.com/api/oauth.access'
const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN

// This is the route that Slack redirects to in order to complete the process
// of adding Metamapper to your team
router.get('/slack/confirm', function (req, res) {
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
      startBot('slack', team)
      // respond with the success "bot added to workspace" page
      res.render('pages/added-to-team')
    })
})


// This is route that slack should be configured to post interactive message responses to
router.post('/slack/interactive-messages', urlencodedParser, function (req, res) {
  res.status(200).end()
  // TODO: check verification code!
  const payload = JSON.parse(req.body.payload)  // parse URL-encoded payload JSON string
  handleInteractiveResponse(payload, res)
})

module.exports = router