const METAMAPS_CLIENT_ID = process.env.METAMAPS_CLIENT_ID
const METAMAPS_CLIENT_SECRET = process.env.METAMAPS_CLIENT_SECRET
const METAMAPS_URL = process.env.METAMAPS_URL
const request = require('request')
const path = require('path')
const express = require('express')
const router = express.Router()

const Token = require('../models/Token')

const { getBot } = require('../bots')
const mmApi = require('../botCode/metamaps')

// the full url that this server is running at
const fullUrl = process.env.PROTOCOL + '://' + process.env.DOMAIN
const metamapsSignInUrl = METAMAPS_URL + '/oauth/authorize'
const metamapsTokenUrl = METAMAPS_URL + '/oauth/token'
const authRoute = '/sign_in'
const metamapsOauthRoute = '/metamaps/confirm'
const metamapsRedirectUri = fullUrl + metamapsOauthRoute

// This is the route that a user navigates initially to, to verify their chat account with Metamaps
// so it just redirects to metamaps
router.get(authRoute, function (req, res) {
  var redirect = metamapsSignInUrl + '?client_id=' + METAMAPS_CLIENT_ID + '&response_type=code&redirect_uri=' + encodeURIComponent(metamapsRedirectUri + '?id=' + req.query.id)
  res.redirect(redirect)
})

// This is the route that Metamaps redirects back to once user authorizes our service to access that account
router.get(metamapsOauthRoute, function (req, res) {
  var code = req.query.code
  var key = req.query.id
  var userId = key.split('/')[1]
  var teamId = key.split('/')[0]
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
    getBot(teamId).addTokenForUser(userId, body.access_token)
    // At this point, we consider it successful and respond with the HTML page
    res.render('pages/user-authenticated')
    // now just to save it in the database, we go back to the Metamaps API and fetch the user ID
    mmApi.getMyId(body.access_token, (err, id) => {
      if (err) {
        console.log('error fetching id for user')
        return
      }
      token.set('mm_user_id', id.toString())
      token.save()
      getBot(teamId).addMmUserId(token.get('mm_user_id'), token.get('user_id'))
    })
  })
})

module.exports = router