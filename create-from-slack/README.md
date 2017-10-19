# create-from-slack

steps

1. require in this module
2. call the function that this module exports with the following:

```
var Bot = require('create-from-slack')

var team = {
  bot_team_id: 'T1029922J1',
  bot_access_token: 'asdasdifuajskdfjasdlfjsasdflkjasj'
}

var tokens = {
// key is the slack user id, value is the token for metamaps
  U10292FF9: 'xoodasfaUUAS99a9ss',
  U8D887D90: 'adiuaIIu9999a9sdf9'
}

// you must be running some kind of server that can verify as an authorized application to the metamaps instance
// you wish to integrate with.
// users will be directed to this URL, and then redirected to authorize with metamaps,
// if they don't have a token
var signInUrl = 'https://metamapper.herokuapp.com/sign_in'

// the domain of the metamaps instance you wish to integrate with
var metamapsDomain = 'https://metamaps.cc'

var addNewUserToken = Bot(team, tokens, signInUrl, metamapsDomain)

// call this function to add a token for another slack user
addNewUserToken(userWhateverId, tokenForUser)
```

see https://github.com/metamaps/metamapper/blob/master/server.js for an example
