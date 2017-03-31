var request = require('request');
var noApiRootUrl,
    rootUrl,
    synapseCreateUrl,
    topicCreateUrl,
    mappingCreateUrl,
    mappingDeleteUrl,
    mapCreateUrl,
    mapsUrl,
    mapUrl,
    usersUrl,
    coordForMap = {};

function incrementX(mapId) {
  if (typeof coordForMap[mapId] !== 'undefined') {
    coordForMap[mapId] = coordForMap[mapId] + 300;
  } else {
      coordForMap[mapId] = 0;
  }
  return coordForMap[mapId];
}

var toExport = {
  metacodes: [
    // first column is metacode name, second column is metacode id
    ["Location",      21578242,   'mm_location'],
    ["Experience",    51848956,   'mm_experience'],
    ["Question",      92282751,   'mm_question'],
    ["Action",        100698720,  'mm_action'],
    ["Reference",     112740059,  'mm_reference'],
    ["Process",       113629430,  'mm_process'],
    ["Problem",       125146708,  'mm_problem'],
    ["Open Issue",    241469500,  'mm_open_issue'],
    ["Catalyst",      281110143,  'mm_catalyst'],
    ["Group",         298486374,  'mm_group'],
    ["Feedback",      339908452,  'mm_feedback'],
    ["Future Dev",    374648174,  'mm_future_dev'],
    ["Role",          378666952,  'mm_role'],
    ["Need",          434890094,  'mm_need'],
    ["Intention",     457008489,  'mm_intention'],
    ["Insight",       507103779,  'mm_insight'],
    ["Platform",      510532105,  'mm_platform'],
    ["Task",          513543911,  'mm_task'],
    ["Trajectory",    546325864,  'mm_trajectory'],
    ["Knowledge",     587967610,  'mm_knowledge'],
    ["Idea",          638205575,  'mm_idea'],
    ["Resource",      843966974,  'mm_resource'],
    ["Tool",          854565971,  'mm_tool'],
    ["Activity",      912136629,  'mm_activity'],
    ["Person",        980190962,  'mm_person'],
    ["Implication",   991788158,  'mm_implication'],
    ["Closed",        1018350795, 'mm_closed'],
    ["Opportunity",   1047793131, 'mm_opportunity'],
    ["Argument",      1047793132, 'mm_argument'],
    ["Con",           1047793133, 'mm_con'],
    ["Decision",      1047793134, 'mm_decision'],
    ["Example",       1047793135, 'mm_example'],
    ["Aim",           1047793136, 'mm_aim'],
    ["Good Practice", 1047793137, 'mm_good_practice'],
    ["List",          1047793138, 'mm_list'],
    ["Story",         1047793139, 'mm_story'],
    ["Note",          1047793140, 'mm_note'],
    ["Pro",           1047793141, 'mm_pro'],
    ["Research",      1047793142, 'mm_research'],
    ["Wildcard",      1047793143, 'mm_wildcard'],
    ["Subject",       1047793144, 'mm_subject'],
    ["Event",         1047793145, 'mm_event'],
    ["Media",         1047793146, 'mm_media'],
    ["Metamap",       1047793147, 'mm_metamap'],
    ["Model",         1047793148, 'mm_model'],
    ["Perspective",   1047793149, 'mm_perspective'],
    ["Project",       1047793150, 'mm_project'],
    ["Status",        1047793151, 'mm_status']
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
    const regMatch = toExport.emojiRegex.exec(text)
    return regMatch && regMatch[0].split(':')[1]
  },
  findMetacodeByNameIdOrEmoji: function (nameIdOrEmoji) {
    let m
    const type = typeof nameIdOrEmoji === 'number' ? 'id' :
                   nameIdOrEmoji.slice(0,3) === 'mm_' ? 'emoji' : 'name'
    toExport.metacodes.forEach(function (metacode) {
      if ((type === 'name' && metacode[0].toLowerCase() === nameIdOrEmoji.toLowerCase())
          || (type === 'emoji' && metacode[2] === nameIdOrEmoji)
          || (type === 'id' && metacode[1] === nameIdOrEmoji)) {
        m = metacode
      }
    })
    return m
  },
  findMetacodeName: function (idOrEmoji) {
    const metacode = toExport.findMetacodeByNameIdOrEmoji(idOrEmoji)
    return metacode && metacode[0]
  },
  findMetacodeId: function (nameOrEmoji) {
    const metacode = toExport.findMetacodeByNameIdOrEmoji(nameOrEmoji)
    return metacode && metacode[1]
  },
  findMetacodeEmoji: function (idOrName) {
    const metacode = toExport.findMetacodeByNameIdOrEmoji(idOrName)
    return metacode && metacode[2]
  },
  addTopicToMap: function (map, topic, token, callback) {
    topic.desc = topic.desc || ''
    if (topic.name.length > 140) {
      topic.desc = '...' + topic.name.substr(137) + '\n' + topic.desc
      topic.name = topic.name.slice(0, 137) + '...'
    }
    topic.permission = topic.permission || 'commons';
    topic.link = topic.link || '';
    request.post({
      url: topicCreateUrl,
      form: {
        access_token: token,
        topic: topic
      }
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode);
        console.log('body: ', body);
        return callback('topic failed');
      }
      var body = JSON.parse(body);
      var topicId = body.data.id;
      var mapping = {
        mappable_id: topicId,
        mappable_type: 'Topic',
        map_id: map,
        xloc: incrementX(map),
        yloc: 0
      };
      request.post({
        url: mappingCreateUrl,
        form: {
          access_token: token,
          mapping: mapping
        }
      }, function (err, response, body) {
        if (err || response.statusCode > 200) {
          console.log(err || 'statusCode: ' + response.statusCode);
          console.log('body: ', body);
          return callback('mapping failed', topicId);
        }
        var body = JSON.parse(body);
        callback(null, topicId, body.data.id);
      });
    });
  },
  addSynapseToMap: function (map, synapse, token, callback) {
    synapse.permission = synapse.permission || 'commons';
    synapse.desc = synapse.desc || '';
    request.post({
      url: synapseCreateUrl,
      form: {
        access_token: token,
        synapse: synapse
      }
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode);
        console.log('body: ', body);
        return callback('synapse failed');
      }
      var body = JSON.parse(body);
      var synapseId = body.data.id;
      var mapping = {
        mappable_id: synapseId,
        mappable_type: 'Synapse',
        map_id: map
      };
      request.post({
        url: mappingCreateUrl,
        form: {
          access_token: token,
          mapping: mapping
        }
      }, function (err, response, body) {
        if (err || response.statusCode > 200) {
          console.log(err || 'statusCode: ' + response.statusCode);
          console.log('body: ', body);
          return callback('mapping failed', synapseId);
        }
        var body = JSON.parse(body);
        callback(null, synapseId, body.data.id);
      });
    });
  },
  findTopicWithLink: function (link, token, callback) {
    request.get({
      url: topicsUrl + '?access_token=' + token + '&q=' + link
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode);
        console.log('body: ', body);
        return callback('fetching topic failed');
      }
      var body = JSON.parse(body);
      callback(null, body.data[0]);
    });
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
        console.log(err || 'statusCode: ' + response.statusCode);
        console.log('body: ', body);
        return callback('deleting mapping failed');
      }
      callback(null);
    });
  },
  getMap: function (id, token, callback) {
    request.get({
      url: mapUrl + id + '?access_token=' + token + '&embed=topics,synapses,mappings'
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode);
        console.log('body: ', body);
        return callback('fetching map failed');
      }
      var body = JSON.parse(body);
      callback(null, body.data);
    });
  },
  getCurrentUser: function (token, callback) {
    request.get({
      url: `${usersUrl}/current?access_token=${token}`
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || `statusCode: ${response.statusCode}`);
        console.log(`body: ${body}`);
        return callback('fetching current user failed');
      }
      var body = JSON.parse(body);
      callback(null, body.data);
    });
  },
  getMyMaps: function (userid, page, token, callback) {
    request.get({
      url: `${mapsUrl}?access_token=${token}&user_id=${userid}&page=${page}`
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || `statusCode: ${response.statusCode}`);
        console.log(`body: ${body}`);
        return callback('fetching my maps failed');
      }
      var body = JSON.parse(body);
      callback(null, body.data, body.page);
    });
  },
  getMyId: function (token, callback) {
    request.get({
      url: `${usersUrl}/current?access_token=${token}`
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || `statusCode: ${response.statusCode}`);
        console.log(`body: ${body}`);
        return callback('fetching me failed');
      }
      var body = JSON.parse(body);
      callback(null, body.data.id);
    });
  },
  createMap: function (name, token, callback) {
    var map = {
      name: name,
      permission: 'commons',
      arranged: true
    };
    request.post({
      url: mapCreateUrl,
      form: {
        access_token: token,
        map: map
      }
    }, function (err, response, body) {
      if (err || response.statusCode > 200) {
        console.log(err || 'statusCode: ' + response.statusCode);
        console.log('body: ', body);
        return callback('creating map failed');
      }
      var body = JSON.parse(body);
      callback(null, body.data.id);
    });
  },
  formatTopicsForDisplay: function (topics) {
    var string = ''
    topics.forEach(t => {
      const metacode = toExport.findMetacodeByNameIdOrEmoji(t.metacode_id)
      string += `:${metacode[2]}: `
      const mapID = metacode[0] === "Metamap" ? 'ID: ' + t.id : ''
      string += `<${noApiRootUrl}/topics/${t.id}|${t.name}> (${metacode[0]} ${mapID})\n`
    })
    return string
  },
  formatMapsForDisplay: function (maps, pageData) {
    var mapList = maps.map(m => {
      return `<${noApiRootUrl}/maps/${m.id}|${m.name}> (${m.id})\n`;
    }).join('')
    var { current_page, total_pages } = pageData
    if (current_page < total_pages) {
      mapList += `There are ${total_pages - current_page} more pages.\n`
      mapList += `Use: \`my maps ${current_page + 1}\` for the next page.\n`
    }
    return mapList
  }
}

module.exports = function (METAMAPS_URL) {
  noApiRootUrl = METAMAPS_URL;
  rootUrl = METAMAPS_URL + '/api/v2';
  topicCreateUrl = rootUrl + '/topics';
  synapseCreateUrl = rootUrl + '/synapses';
  mappingCreateUrl = rootUrl + '/mappings';
  mappingDeleteUrl = rootUrl + '/mappings'; // + ID
  mapCreateUrl = rootUrl + '/maps';
  mapsUrl = rootUrl + '/maps';
  topicsUrl = rootUrl + '/topics';
  mapUrl = rootUrl + '/maps/'; // + ID
  usersUrl = rootUrl + '/users';
  return toExport;
}
