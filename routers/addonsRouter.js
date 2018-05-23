const request = require('request')
const path = require('path')
const express = require('express')
const router = express.Router()

router.get('/authed', function (req, res) {
  res.render('pages/user-authenticated')
})
router.get('/added-to-team', function (req, res) {
  res.render('pages/added-to-team')
})

router.post('/webhooks/zoom', function (req, res) {
  const coworkingID = 6475679423
  res.send('ok')
  const { event } = req.body
  const { meeting } = req.body.payload
  let event_text
  // ignore rooms besides 'coworking' for now
  if (meeting.id === coworkingID){
    if (event === 'participant_joined') {
      event_text = `${meeting.participant.user_name} joined the coworking room`
    } else if (event === 'participant_left') {
      event_text = `${meeting.participant.user_name} left the coworking room`
    }
  }

  // if its a relevant event, pass along to the mattermost server
  if (event_text) {
    request.post({
      uri: process.env.MATTERMOST_WEBHOOK,
      body: {
        text: event_text
      },
      json: true
    })
  }
})

// This is a random endpoint that is currently being used by Robert Best
// TODO: factor this out!
router.post('/slack-special-endpoint-123', function (req, res) {
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

  //MetaHolo
  if (event && event.text !== null && req.body.team_id === teamId && event.channel === torss && source === "MetaHolo" && event.subtype !== "message_changed"){
    request.post({
      url: 'https://maker.ifttt.com/trigger/MetaHolo/with/key/hh-WIsHemQcfoom10g493hQM9KqTQVcYf_aCNQmJj_v',
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

module.exports = router
