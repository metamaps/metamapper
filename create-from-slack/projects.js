var Metamaps = require('./metamaps.js')
const { dmForUserId, userNameForUserId } = require('./clientHelpers.js')
var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var projectMapId

var YES_ANSWERS = [
  'Yes',
  'Yep',
  'Ya',
  'Si',
  'Y',
  'yes',
  'yep',
  'ya',
  'si',
  'y'
]
var NO_ANSWERS = [
  'No',
  'Nope',
  'Nay',
  'N',
  'no',
  'nope',
  'nay',
  'n'
]

//new line
function nl(text) {
  return text + ' \n'
}

//bold
function bd(text) {
  return '*' + text + '*'
}

// instructions
function ins() {
  return ' (respond *yes*, *no*, or *cancel*)'
}

// format a project list
function pl(projects, withNumbers) {
  var list = ''
  projects.forEach(function(p, index) {
    var text = ''
    if (withNumbers) text += (index + 1) + '. ' + p.name
    else text = p.name
    list += nl(bd(text))
  })
  return list
}

function findOrCreatePerson(name, token, callback) {
  var personMetacode = Metamaps.findMetacodeId('Person')
  Metamaps.getMap(projectMapId, token, function (err, map) {
    if (err) return callback(err)
    var person = map.topics.find(function(t) { return t.name === name })
    if (person) return callback(null, person.id)
    Metamaps.addTopicToMap(projectMapId, { name: name, metacode_id: personMetacode }, token, function (err, topicId, mappingId) {
      callback(err, topicId)
    })
  })
}

function diffProjects(userProjects, allProjects, excludeProjects) {
  var diff = allProjects.filter(function(p) {
    return !excludeProjects.find(function (e) { return e.id === p.id }) && !userProjects.find(function (u) { return u.id === p.id })
  })
  return diff
}

module.exports = {
  setProjectMapId: function (id) {
    projectMapId = id
  },
  getUpdates: function (context) {
    const { rtmBot, tokens } = context
    // contact each person who has signed in with Metamaps to see what projects they're working on
    //each user is going to have a Person node on the map, whose name correlates with their user name
    Object.keys(tokens).forEach(function (userId) {
      // look for a node on the map with the user name of the user
      // if there isn't one, create it, if there is one, use that
      // talk to that person to figure out what they're working on
      dmForUserId(context, userId, dm => {
        var name = userNameForUserId(context, userId)
        var removedProjects = []
        var projects = []
        var person

        function addPersonToProject(project) {
          var synapse = {
            desc: 'is working on',
            topic1_id: person,
            topic2_id: project.id,
            category: 'from-to'
          }
          Metamaps.addSynapseToMap(projectMapId, synapse, tokens[userId], function (err, synapseId, mappingId) {
            if (err) {
              console.log('sugar!', err)
              return
            }
            synapse.id = synapseId
            project.synapse = synapse
            project.mapping = {
              id: mappingId
            }
            projects.push(project)
          })
        }

        function removePersonFromProject(project) {
          removedProjects.push(project)
          projects = projects.filter(function (p) { return p.id !== project.id })
          Metamaps.deleteMapping(project.mapping.id, tokens[userId], function () {})
        }

        function createProjectForPerson(projectName) {
          var projectMetacode = Metamaps.findMetacodeId('Project')
          var project = { name: projectName, metacode_id: projectMetacode }
          Metamaps.addTopicToMap(projectMapId, project, tokens[userId],
            function (err, topicId, mappingId) {
              if (err) {
                console.log('sugar!', err)
                return
              }
              project.id = topicId
              addPersonToProject(project)
            })
        }

        function send(text) {
          rtmBot.sendMessage(text, dm)
        }

        function yesNoQstn(question, yes, no, dontMessage) {
          if (!dontMessage) send(question + ins())
          rtmBot.once(RTM_EVENTS.MESSAGE, function (message) {
            if (message.channel !== dm) {
              yesNoQstn(question, yes, no, true)
              return
            }
            else if (YES_ANSWERS.indexOf(message.text) > -1) return yes()
            else if (NO_ANSWERS.indexOf(message.text) > -1) return no()
            else if (message.text === 'cancel') {
              send('Ok, let\'s continue the conversation later.')
            }
            else {
              yesNoQstn(question, yes, no, true)
            }
          })
        }

        function actionTillDone(action, done) {
          rtmBot.once(RTM_EVENTS.MESSAGE, function (message) {
            if (message.channel !== dm) {
              actionTillDone(action, done)
              return
            }
            else if (message.text === 'done') return done()
            else {
              action(message.text)
              actionTillDone(action, done)
            }
          })
        }

        function noUpdates() {
          send('Great! I\'m glad we\'re up to speed.')
        }

        function letsNotUpdate() {
          send('No problem. Let\'s chat later.')
        }

        function newProjects() {
          send('To add new projects you\'re working on, *list off their names one by one in separate messages*, and once you\'re finished, type: *done*')
          actionTillDone(createProjectForPerson, function() {
            send('Awesome! That\'s it, we\'re all up to speed. I\'ve now got you down as working on:')
            send(pl(projects))
          })
        }

        function collectProjects() {
          module.exports.fetchProjects(tokens[userId], function (err, prjts, map) {
            var otherProjects = diffProjects(projects, prjts, removedProjects) // projects not being worked on by the user
            if (!otherProjects.length) {
              return yesNoQstn('Since there\'s no other existing projects, would you like to add any that you\'re working on?',
                        newProjects, letsNotUpdate)
            }
            send('Ok, let\'s see if you\'re working on any of the existing projects. Here they are:')
            send(pl(otherProjects, true))
            // recurse over otherProjects to see which ones the user is working on
            function isWorkingOn(index) {
              var next = otherProjects[index + 1] ? function() { isWorkingOn(index+1) } : newProjects
              function yes() {
                addPersonToProject(otherProjects[index])
                next()
              }
              yesNoQstn('Are you working on project ' + bd(otherProjects[index].name) + '?', yes, next)
            }
            isWorkingOn(0)
          })
        }

        function removeProjects() {
          send(nl('Ok, let\'s go through them one by one:'))
          // recurse over projects to see which ones the user is still working on
          function isWorkingOn(index) {
            var next = projects[index - 1] ? function() { isWorkingOn(index-1) } : collectProjects
            function no() {
              removePersonFromProject(projects[index])
              next()
            }
            yesNoQstn('Are you still working on project ' + bd(projects[index].name) + '?', next, no)
          }
          isWorkingOn(projects.length - 1)
        }

        function checkRemoveProjects() {
          yesNoQstn('Are you still working on all the listed projects?', collectProjects, removeProjects)
        }

        function showProjects() {
          yesNoQstn('Here\'s what I\'ve got you down as working on: \n' + pl(projects) + ' Do I need to update this at all?',
                    checkRemoveProjects, noUpdates)
        }

        function letsUpdate() {
          send('Great! Let\'s get started')
          if (!projects.length) collectProjects()
          else showProjects()
        }

        findOrCreatePerson(name, tokens[userId], function (err, personId) {
          if (err) {
            console.log(err)
            return
          }
          person = personId
          module.exports.fetchProjectsForUser(name, tokens[userId], function (err, prjts) {
            projects = prjts
            yesNoQstn('Hello there! Do you have some time to update me on which projects you\'re working on?', letsUpdate, letsNotUpdate)
          })
        })
      })
    })
  },
  displayAll: function (token, callback) {
    var list = nl('Here\'s all the projects and who\'s working on them:')
    module.exports.fetchProjects(token, function (err, projects, map) {
      projects.forEach(function(p, index) {
        list += nl(bd(p.name))
        var people = map.synapses.filter(function(s) {
          return s.topic2_id === p.id && s.desc === 'is working on'
        }).map(function(s) {
          var person = map.topics.find(function(t) { return t.id === s.topic1_id })
          if (person) list += '--' + nl(person.name)
        })
        if (!people.length) list += nl('-- There\'s no one on this project currently')
      })
      callback(null, list)
    })
  },
  displayForUser: function (name, token, callback) {
    var list = nl('Here\'s your projects and collaborators:')
    module.exports.fetchProjectsForUser(name, token, function (err, projects, map) {
      projects.forEach(function(p, index) {
        list += nl(bd(p.name))
        var people = map.synapses.filter(function(s) {
          return s.topic2_id === p.id && s.desc === 'is working on'
        }).map(function(s) {
          var person = map.topics.find(function(t) { return t.id === s.topic1_id })
          if (person && person.name !== name) list += '--' + nl(person.name)
        })
      })
      callback(null, list)
    })
  },
  fetchProjectsForUser: function (name, token, callback) {
    var projectMetacodeId = Metamaps.findMetacodeId('Project')

    Metamaps.getMap(projectMapId, token, function (err, map) {
      var person = map.topics.find(function(t){ return t.name === name })
      if (!person) return callback(null, [])
      var possibleProjects = map.synapses.filter(function(s) {
        return s.desc === 'is working on'
      })
      if (!possibleProjects.length) return callback(null, [])
      var projects = map.topics.map(function(t) {
        if (t.metacode_id !== projectMetacodeId) return null
        var synapse = possibleProjects.find(function(s) {
          return s.topic1_id === person.id && s.topic2_id === t.id
        })
        if (synapse) {
          t.synapse = synapse
          t.mapping = map.mappings.find(function (m) { return m.mappable_id === synapse.id && m.mappable_type === 'Synapse' })
        }
        else t = null
        return t
      }).filter(function (t) { return t })
      callback(null, projects, map)
    })
  },
  fetchProjects: function (token, callback) {
    var projectMetacodeId = Metamaps.findMetacodeId('Project')

    Metamaps.getMap(projectMapId, token, function (err, map) {
      if (err) return callback(err)
      var projects = map.topics.filter(function (t) { return t.metacode_id === projectMetacodeId })
      callback(null, projects, map)
    })
  }
}
