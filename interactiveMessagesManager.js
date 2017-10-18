const uuid = require('uuid')
const request = require('request')

let interactiveMessageCallbacks = {}

function sendMessageToSlackResponseURL(responseURL, JSONmessage){
  var postOptions = {
    uri: responseURL,
    method: 'POST',
    headers: {
        'Content-type': 'application/json'
    },
    json: JSONmessage
  }
  request(postOptions, (error, response, body) => {
    if (error){
        // handle errors as you see fit
    }
  })
}
module.exports.sendMessageToSlackResponseURL = sendMessageToSlackResponseURL

function interactiveResponse (context, dm, config, cb) {
  const { webBot } = context
  const { text, options } = config
  const callback_id = uuid()
  const toAttach = buttonAttachments(text, options, callback_id)
  webBot.chat.postMessage(dm, text, toAttach, function (err, response) {
    if (err) {
      cb(err)
      return
    }
    interactiveMessageCallbacks[callback_id] = {
      cb,
      text
    }
  })
}
module.exports.interactiveResponse = interactiveResponse


function clearInteractiveResponses () {
  // todo: instead, iterate through and call the callbacks
  // as having not completed
  interactiveMessageCallbacks = {}
}
module.exports.clearInteractiveResponses = clearInteractiveResponses


function handleInteractiveResponse (payload, res) {
  const { actions, callback_id } = payload
  const interactiveMessage = interactiveMessageCallbacks[callback_id]
  // todo: should this be an error?
  if (!interactiveMessage) return

  const value = actions[0].value
  let updated
  if (value === "1") {
    updated = ":white_check_mark: You agreed"
  } else if (value === "-1") {
    updated = ":x: You disagreed"
  } else if (value ==="0") {
    updated = ":wave: You passed"
  }
  var message = {
      "text": interactiveMessage.text,
      "attachments": attachment(updated),
      "replace_original": true
  }
  sendMessageToSlackResponseURL(payload.response_url, message)
  interactiveMessage.cb(null, value)
}
module.exports.handleInteractiveResponse = handleInteractiveResponse


function attachment (text) {
  return [
    {
      "text": text,
      "color": "#3AA3E3",
      "attachment_type": "default"
    }
  ]
}
module.exports.attachment = attachment

function buttonAttachments (text, options = [], callback_id) {
  return {
    "attachments": [
      {
        "fallback": "You are unable to offer your opinion",
        "callback_id": callback_id,
        "color": "#3AA3E3",
        "attachment_type": "default",
        "actions": options.map(o => {
          return {
            "name": "watthisdoes?",
            "type": "button",
            "text": o.text,
            "value": o.value
          }
        })
      }
    ]
  }
}
module.exports.buttonAttachments = buttonAttachments