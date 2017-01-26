module.exports = function (web, rtm, tokens, users, persistToken, botId, METAMAPS_URL, signInUrl, dmForUserId, userName, projectMapId, setProjectMap, teamName) {
  var Metamaps = require('./metamaps.js')(METAMAPS_URL)
  var projects = require('./projects.js')(METAMAPS_URL)
  var metacodes = Metamaps.metacodes
  var mapsForChannel = {}
  var metacodesForChannel = {}
  var captureForChannel = {}

  if (projectMapId) projects.setProjectMapId(projectMapId)

  function postTopicsToMetamaps(topics, userId, channel, timestamp) {
    var addToMap = mapsForChannel[channel]
    topics.forEach(function (topic) {
      Metamaps.addTopicToMap(addToMap, topic, tokens[userId], function (err, topicId, mappingId) {
        if (err == 'topic failed') {
          rtm.sendMessage('failed to create your topic', channel)
        } else if (err == 'mapping failed') {
          rtm.sendMessage('successfully created topic (id: ' + topicId + '), but failed to add it to map ' + addToMap, channel)
        } else {
          web.reactions.add('thumbsup', {channel: channel, timestamp: timestamp})
        }
      })
    })
  }

  function setLocalProjectMap (mapId, channel) {
    projectMapId = mapId // set within this function
    projects.setProjectMapId(mapId) // update the projects module
    setProjectMap(mapId) // save to database
    rtm.sendMessage('Map for projects was updated', channel)
  }

  function createMapForProjects(token, channel) {
    Metamaps.createMap(teamName + " Projects", token, function (err, id) {
      if (!err) {
        setLocalProjectMap(id, channel)
        rtm.sendMessage('You can now use the projects functionality', channel)
      }
    })
  }

  var COMMANDS = [
    {
      cmd: "start capture",
      variable: "",
      inHelpList: true,
      helpText: "capture every message to the map set for your current channel",
      requireUser: true,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (!mapsForChannel[message.channel]) {
          rtm.sendMessage('You need to set a map for this channel first. Use \'set map\' or \'create map\'', message.channel);
          return
        }
        captureForChannel[message.channel] = true;
        rtm.sendMessage('Ok, I will capture every message to map ' + mapsForChannel[message.channel] + ' until you type \'stop capture\'', message.channel);
      }
    },
    {
      cmd: "stop capture",
      variable: "",
      inHelpList: true,
      helpText: "stop capturing every message to the map set for your current channel",
      requireUser: true,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (!captureForChannel[message.channel]) {
          rtm.sendMessage('You weren\'t capturing anywho!', message.channel);
          return
        }
        captureForChannel[message.channel] = false;
        rtm.sendMessage('Ok, I\'ve stopped capturing every message to the map', message.channel);
      }
    },
    {
      cmd: "",
      variable: "",
      inHelpList: false,
      requireUser: true,
      check: function (message) {
        return captureForChannel[message.channel];
      },
      run: function (message) {
        if (!metacodesForChannel[message.channel]) {
          rtm.sendMessage('default metacode is not set. set it by using `set metacode [metacode_name]`', message.channel)
          return;
        }
        var topic_name = message.text;
        postTopicsToMetamaps([
          { metacode_id: metacodesForChannel[message.channel], name: topic_name.trim() }
        ], message.user, message.channel, message.ts);
      }
    },
    {
      cmd: "signed in?",
      variable: "",
      inHelpList: true,
      helpText: "check whether you're account is connected to your metamaps account",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (tokens[message.user]) {
          rtm.sendMessage('Yes, you\'re signed in to metamaps.', message.channel);
        } else {
          var id = rtm.activeTeamId + message.user;
          rtm.sendMessage('Nope. You\'re not signed in to metamaps. Click here to sign in: ' + signInUrl + '?id=' + id, message.channel);
        }
      }
    },
    {
      cmd: "my maps ",
      variable: "[PAGE]",
      inHelpList: true,
      helpText: "see a list of your maps",
      requireUser: true,
      check: function (message) {
        return true;
      },
      run: function (message) {
        // once we have the MM user id, we can run this function
        var getMaps = (userid) => {
          var page = parseInt(message.text.substring(7)) || 1;
          Metamaps.getMyMaps(userid, page, tokens[message.user], function (err, maps, pageData) {
            if (err) {
              return rtm.sendMessage('there was an error retrieving your maps', message.channel);
            }
            rtm.sendMessage(Metamaps.formatMapsForDisplay(maps, pageData) + '\n', message.channel);
          });
        }

        // if the MM user id is cached, use it. otherwise, find it.
        if (users[message.user]) {
          return getMaps(users[message.user].id);
        } else {
          Metamaps.getCurrentUser(tokens[message.user], function (err, user) {
            users[message.user] = user
            return getMaps(user.id)
          })
        }
      }
    },
    {
      cmd: "set map ",
      variable: "[MAP_ID]",
      inHelpList: true,
      helpText: "set the map on which new topics created in that channel will appear",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        mapsForChannel[message.channel] = message.text.substring(8);
        rtm.sendMessage('Ok, I\'ve switched to map ' + mapsForChannel[message.channel] + ' for this channel', message.channel);
      }
    },
    {
      cmd: "which map",
      variable: "",
      inHelpList: true,
      helpText: "tell me which map this channel is currently set to",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (mapsForChannel[message.channel]) {
          rtm.sendMessage('You\'re on map ' + mapsForChannel[message.channel] + ' for this channel', message.channel);   
        } else {
          rtm.sendMessage('There is no map set for this channel', message.channel);
        }
      }
    },
    {
      cmd: "show map ",
      variable: "[MAP_ID]",
      inHelpList: true,
      helpText: "return all the topics for a given map id in a list",
      requireUser: true,
      check: function (message) {
        return true;
      },
      run: function (message) {
        var id = message.text.substring(9);
        Metamaps.getMap(id, tokens[message.user], function (err, map) {
          if (err) {
            return rtm.sendMessage('there was an error retrieving the map', message.channel);
          }
          rtm.sendMessage(Metamaps.formatTopicsForDisplay(map.topics) + '\n' + METAMAPS_URL + '/maps/' + id, message.channel);
        });
      }
    },
    {
      cmd: "open map ",
      variable: "[MAP_ID]",
      inHelpList: true,
      helpText: "return a link to open the map",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        var id = message.text.substring(9);
        rtm.sendMessage(METAMAPS_URL + '/maps/' + id, message.channel);
      }
    },
    {
      cmd: "create map ",
      variable: "[NAME_OF_MAP]",
      inHelpList: true,
      helpText: "create a map on metamaps by specifying its name",
      requireUser: true,
      check: function (message) {
        return true;
      },
      run: function (message) {
        Metamaps.createMap(message.text.substring(11), tokens[message.user], function (err, mapId) {
          if (err) {
            return rtm.sendMessage('there was an error creating the map', message.channel);
          }
          mapsForChannel[message.channel] = mapId;
          rtm.sendMessage('new map was created with id ' + mapId + ' and set for mapping', message.channel);
        });
      }
    },
    {
      cmd: "set metacode ",
      variable: "[METACODE_NAME]",
      inHelpList: true,
      helpText: "set the default metacode to use for the channel",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        var metacode_name = message.text.substring(13);
        var m = Metamaps.findMetacodeByNameOrId(metacode_name);
        if (!m) {
          rtm.sendMessage(metacode_name + ' isn\'t an enabled metacode', message.channel); // list available metacodes?
          return;
        }
        metacodesForChannel[message.channel] = m[1]; // the ID
        rtm.sendMessage('Ok, I\'ve switched the default metacode for this channel to *' + metacode_name + '*', message.channel);
      }
    },
    {
      cmd: "mm: ",
      variable: "[TOPIC_NAME]",
      inHelpList: true,
      helpText: "use default metacode for the channel to create a topic",
      requireUser: true,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (!metacodesForChannel[message.channel]) {
          rtm.sendMessage('default metacode is not set. set it by using `set metacode [metacode_name]`', message.channel)
          return;
        }
        var topic_name = message.text.substring(4);
        postTopicsToMetamaps([
          { metacode_id: metacodesForChannel[message.channel], name: topic_name.trim() }
        ], message.user, message.channel, message.ts);
      }
    },
    {
      cmd: "projects",
      variable: "",
      inHelpList: true,
      helpText: "see who is working on what projects",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (projectMapId) {
          projects.displayAll(tokens[message.user], function (err, prjcts) {
            if (err) {
              console.log(err)
              prjcts = 'There was an error fetching your projects. Try again?'
            }
            if (!prjcts) prjcts = 'There are no active projects'
            rtm.sendMessage(prjcts, message.channel)
          })
        }
        else if (tokens[message.user]) createMapForProjects(tokens[message.user], message.channel)
      }
    },
    {
      cmd: "my projects",
      variable: "",
      inHelpList: true,
      helpText: "see my projects and collaborators",
      requireUser: true,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (projectMapId) {
          projects.displayForUser(userName(message.user), tokens[message.user], function (err, prjcts) {
            if (err) {
              console.log(err)
              prjcts = 'There was an error fetching your projects. Try again?'
            }
            if (!prjcts) prjcts = 'You have no active projects'
            rtm.sendMessage(prjcts, message.channel)
          })
        }
        else if (tokens[message.user]) createMapForProjects(tokens[message.user], message.channel)
      }
    },
    {
      cmd: "<@" + botId + '> update projects',
      variable: "",
      inHelpList: true,
      helpText: "update who is working on what projects",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        if (projectMapId) projects.getUpdates(rtm, tokens, dmForUserId, userName)
        else if (tokens[message.user]) createMapForProjects(tokens[message.user], message.channel)
      }
    },
    {
      cmd: 'set project map id ',
      variable: "[MAP_ID]",
      inHelpList: false,
      helpText: "set the map which stores project data",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        var mapId = message.text.substring(19)
        setLocalProjectMap(mapId, message.channel)
      }
    },
    {
      cmd: "<@" + botId + '> help',
      variable: "",
      inHelpList: true,
      helpText: "list all the commands that metamapper knows",
      requireUser: false,
      check: function (message) {
        return true;
      },
      run: function (message) {
        var help = 'Hi de ho heyo!\n';
        COMMANDS.forEach(function (command) {
          if (command.inHelpList) help += '*' + command.cmd + command.variable + '* ' + command.helpText + '\n';
        });
        rtm.sendMessage(help, message.channel);
      }
    }
  ];

  return COMMANDS;
};
