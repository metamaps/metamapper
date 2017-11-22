if (process.env.NODE_ENV !== 'production') require('dotenv').config()
var request = require('request')
var METAMAPS_URL = process.env.METAMAPS_URL
var noApiRootUrl = METAMAPS_URL
var rootUrl = METAMAPS_URL + '/api/v2'
var topicCreateUrl = rootUrl + '/topics'
var synapseCreateUrl = rootUrl + '/synapses'
var mappingCreateUrl = rootUrl + '/mappings'
var mappingDeleteUrl = rootUrl + '/mappings' // + ID
var mapCreateUrl = rootUrl + '/maps'
var mapsUrl = rootUrl + '/maps'
var topicsUrl = rootUrl + '/topics'
var mapUrl = rootUrl + '/maps/' // + ID
var usersUrl = rootUrl + '/users'
var coordForMap = {}

function incrementX(mapId) {
  if (typeof coordForMap[mapId] !== 'undefined') {
    coordForMap[mapId] = coordForMap[mapId] + 300
  } else {
      coordForMap[mapId] = 0
  }
  return coordForMap[mapId]
}

module.exports = {
  metacodes: [
    // first column is metacode name, second column is metacode id
    ["Location",      12,   'mm_location'],
    ["Experience",    29,   'mm_experience'],
    ["Question",      42,   'mm_question'],
    ["Action",        1,  'mm_action'],
    ["Reference",     43,  'mm_reference'],
    ["Process",       5,  'mm_process'],
    ["Problem",       18,  'mm_problem'],
    ["Open Issue",    14,  'mm_open_issue'],
    ["Catalyst",      3,  'mm_catalyst'],
    ["Group",         7,  'mm_group'],
    ["Feedback",      30,  'mm_feedback'],
    ["Future Dev",    6,  'mm_future_dev'],
    ["Role",          20,  'mm_role'],
    ["Need",          13,  'mm_need'],
    ["Intention",     10,  'mm_intention'],
    ["Insight",       9,  'mm_insight'],
    ["Platform",      17,  'mm_platform'],
    ["Task",          21,  'mm_task'],
    ["Trajectory",    22,  'mm_trajectory'],
    ["Knowledge",     11,  'mm_knowledge'],
    ["Idea",          33,  'mm_idea'],
    ["Resource",      19,  'mm_resource'],
    ["Tool",          47,  'mm_tool'],
    ["Activity",      2,  'mm_activity'],
    ["Person",        16,  'mm_person'],
    ["Implication",   8,  'mm_implication'],
    ["Closed",        4, 'mm_closed'],
    ["Opportunity",   15, 'mm_opportunity'],
    ["Argument",      23, 'mm_argument'],
    ["Con",           24, 'mm_con'],
    ["Decision",      26, 'mm_decision'],
    ["Example",       28, 'mm_example'],
    ["Aim",           31, 'mm_aim'],
    ["Good Practice", 32, 'mm_good_practice'],
    ["List",          34, 'mm_list'],
    ["Story",         46, 'mm_story'],
    ["Note",          38, 'mm_note'],
    ["Pro",           40, 'mm_pro'],
    ["Research",      44, 'mm_research'],
    ["Wildcard",      48, 'mm_wildcard'],
    ["Subject",       25, 'mm_subject'],
    ["Event",         27, 'mm_event'],
    ["Media",         35, 'mm_media'],
    ["Metamap",       36, 'mm_metamap'],
    ["Model",         37, 'mm_model'],
    ["Perspective",   39, 'mm_perspective'],
    ["Project",       41, 'mm_project'],
    ["Status",        45, 'mm_status']
/*
    ["Action", 1],
    ["Activity", 2],
    ["Catalyst", 3],
    ["Closed", 4],
    ["Process", 5],
    ["Future", 6],
    ["Group", 7],
    ["Implication", 8],
    ["Insight", 9],
    ["Intention", 10],
    ["Knowledge", 11],
    ["Location", 12],
    ["Need", 13],
    ["Open", 14],
    ["Opportunity", 15],
    ["Person", 16],
    ["Platform", 17],
    ["Problem", 18],
    ["Resource", 19],
    ["Role", 20],
    ["Task", 21],
    ["Trajectory", 22],
    ["Argument", 23],
    ["Con", 24],
    ["Subject", 25],
    ["Decision", 26],
    ["Event", 27],
    ["Example", 28],
    ["Experience", 29],
    ["Feedback", 30],
    ["Aim", 31],
    ["Good", 32],
    ["Idea", 33],
    ["List", 34],
    ["Media", 35],
    ["Metamap", 36],
    ["Model", 37],
    ["Note", 38],
    ["Perspective", 39],
    ["Pro", 40],
    ["Project", 41],
    ["Question", 42],
    ["Reference", 43],
    ["Research", 44],
    ["Status", 45],
    ["Tool", 46],
    ["Wildcard", 47]
*/
  ],
  emojiRegex: /:mm_\w+:/g,
  findMetacodeEmojiInText: function (text) {
    const regMatch = module.exports.emojiRegex.exec(text)
    return regMatch && regMatch[0].split(':')[1]
  },
  findMetacodeByNameIdOrEmoji: function (nameIdOrEmoji) {
    let m
    const type = typeof nameIdOrEmoji === 'number' ? 'id' :
                   nameIdOrEmoji.slice(0,3) === 'mm_' ? 'emoji' : 'name'
    module.exports.metacodes.forEach(function (metacode) {
      if ((type === 'name' && metacode[0].toLowerCase() === nameIdOrEmoji.toLowerCase())
          || (type === 'emoji' && metacode[2] === nameIdOrEmoji)
          || (type === 'id' && metacode[1] === nameIdOrEmoji)) {
        m = metacode
      }
    })
    return m
  },
  findMetacodeName: function (idOrEmoji) {
    const metacode = module.exports.findMetacodeByNameIdOrEmoji(idOrEmoji)
    return metacode && metacode[0]
  },
  findMetacodeId: function (nameOrEmoji) {
    const metacode = module.exports.findMetacodeByNameIdOrEmoji(nameOrEmoji)
    return metacode && metacode[1]
  },
  findMetacodeEmoji: function (idOrName) {
    const metacode = module.exports.findMetacodeByNameIdOrEmoji(idOrName)
    return metacode && metacode[2]
  },
  addTopicToMap: function (map, topic, token, callback) {
    topic.desc = topic.desc || ''
    if (topic.name.length > 140) {
      topic.desc = '...' + topic.name.substr(137) + '\n' + topic.desc
      topic.name = topic.name.slice(0, 137) + '...'
    }
    topic.permission = topic.permission || 'commons'
    topic.link = topic.link || ''
    request.post({
      url: topicCreateUrl,
      form: {
        access_token: token,
        topic: topic
      }
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode)
        console.log('body: ', body)
        return callback('topic failed')
      }
      var body = JSON.parse(body)
      var topicId = body.data.id
      var mapping = {
        mappable_id: topicId,
        mappable_type: 'Topic',
        map_id: map,
        xloc: incrementX(map),
        yloc: 0
      }
      request.post({
        url: mappingCreateUrl,
        form: {
          access_token: token,
          mapping: mapping
        }
      }, function (err, response, body) {
        if (err || response.statusCode > 200) {
          console.log(err || 'statusCode: ' + response.statusCode)
          console.log('body: ', body)
          return callback('mapping failed', topicId)
        }
        var body = JSON.parse(body)
        callback(null, topicId, body.data.id)
      })
    })
  },
  addSynapseToMap: function (map, synapse, token, callback) {
    synapse.permission = synapse.permission || 'commons'
    synapse.desc = synapse.desc || ''
    request.post({
      url: synapseCreateUrl,
      form: {
        access_token: token,
        synapse: synapse
      }
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode)
        console.log('body: ', body)
        return callback('synapse failed')
      }
      var body = JSON.parse(body)
      var synapseId = body.data.id
      var mapping = {
        mappable_id: synapseId,
        mappable_type: 'Synapse',
        map_id: map
      }
      request.post({
        url: mappingCreateUrl,
        form: {
          access_token: token,
          mapping: mapping
        }
      }, function (err, response, body) {
        if (err || response.statusCode > 200) {
          console.log(err || 'statusCode: ' + response.statusCode)
          console.log('body: ', body)
          return callback('mapping failed', synapseId)
        }
        var body = JSON.parse(body)
        callback(null, synapseId, body.data.id)
      })
    })
  },
  findTopicWithLink: function (link, token, callback) {
    request.get({
      url: topicsUrl + '?access_token=' + token + '&q=' + link
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode)
        console.log('body: ', body)
        return callback('fetching topic failed')
      }
      var body = JSON.parse(body)
      callback(null, body.data[0])
    })
  },
  deleteMapping: function (id, token, callback) {
    request({
      method: 'DELETE',
      url: mappingDeleteUrl + '/' + id,
      form: {
        access_token: token
      }
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode)
        console.log('body: ', body)
        return callback('deleting mapping failed')
      }
      callback(null)
    })
  },
  getMap: function (id, token, callback) {
    request.get({
      url: mapUrl + id + '?access_token=' + token + '&embed=topics,synapses,mappings'
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode)
        console.log('body: ', body)
        return callback('fetching map failed')
      }
      var body = JSON.parse(body)
      callback(null, body.data)
    })
  },
  getCurrentUser: function (token, callback) {
    request.get({
      url: `${usersUrl}/current?access_token=${token}`
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || `statusCode: ${response.statusCode}`)
        console.log(`body: ${body}`)
        return callback('fetching current user failed')
      }
      var body = JSON.parse(body)
      callback(null, body.data)
    })
  },
  getMyMaps: function (userid, page, token, callback) {
    request.get({
      url: `${mapsUrl}?access_token=${token}&user_id=${userid}&page=${page}`
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || `statusCode: ${response.statusCode}`)
        console.log(`body: ${body}`)
        return callback('fetching my maps failed')
      }
      var body = JSON.parse(body)
      callback(null, body.data, body.page)
    })
  },
  getMyId: function (token, callback) {
    request.get({
      url: `${usersUrl}/current?access_token=${token}`
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || `statusCode: ${response.statusCode}`)
        console.log(`body: ${body}`)
        return callback('fetching me failed')
      }
      var body = JSON.parse(body)
      callback(null, body.data.id)
    })
  },
  createMap: function (map, token, callback) {
    map = {
      name: map.name,
      desc: map.desc || '',
      permission: map.permission || 'commons',
      arranged: true
    }
    request.post({
      url: mapCreateUrl,
      form: {
        access_token: token,
        map: map
      }
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode)
        console.log('body: ', body)
        return callback('creating map failed')
      }
      var body = JSON.parse(body)
      callback(null, body.data)
    })
  },
  formatTopicsForDisplay: function (topics, withId) {
    var string = ''
    topics.forEach(t => {
      const metacode = module.exports.findMetacodeByNameIdOrEmoji(t.metacode_id)
      string += `:${metacode[2]}: `
      /*
      const mapID = ''
      if (metacode[0] === "Metamap"){
        const linkArray = t.link.split('/')
        mapID = 'ID: ' + linkArray[linkArray.length - 1]
      }
      */

      string += `${withId ? `(${t.id}) ` : ''}<${noApiRootUrl}/topics/${t.id}|${t.name}> (${metacode[0]})\n` //add in ${mapID}
    })
    return string
  },
  formatMapsForDisplay: function (maps, pageData) {
    var mapList = maps.map(m => {
      return `<${noApiRootUrl}/maps/${m.id}|${m.name}> (${m.id})\n`
    }).join('')
    var { current_page, total_pages } = pageData
    if (current_page < total_pages) {
      mapList += `There are ${total_pages - current_page} more pages.\n`
      mapList += `Use: \`my maps ${current_page + 1}\` for the next page.\n`
    }
    return mapList
  }
}
