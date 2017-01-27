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
    ["Location", 21578242],
    ["Experience", 51848956],
    ["Question", 92282751],
    ["Action", 100698720],
    ["Reference", 112740059],
    ["Process", 113629430],
    ["Problem", 125146708],
    ["Open Issue", 241469500],
    ["Catalyst", 281110143],
    ["Group", 298486374],
    ["Feedback", 339908452],
    ["Future Dev", 374648174],
    ["Role", 378666952],
    ["Need", 434890094],
    ["Intention", 457008489],
    ["Insight", 507103779],
    ["Platform", 510532105],
    ["Task", 513543911],
    ["Trajectory", 546325864],
    ["Knowledge", 587967610],
    ["Idea", 638205575],
    ["Resource", 843966974],
    ["Tool", 854565971],
    ["Activity", 912136629],
    ["Person", 980190962],
    ["Implication", 991788158],
    ["Closed", 1018350795],
    ["Opportunity", 1047793131],
    ["Argument", 1047793132],
    ["Con", 1047793133],
    ["Decision", 1047793134],
    ["Example", 1047793135],
    ["Aim", 1047793136],
    ["Good Practice", 1047793137],
    ["List", 1047793138],
    ["Story", 1047793139],
    ["Note", 1047793140],
    ["Pro", 1047793141],
    ["Research", 1047793142],
    ["Wildcard", 1047793143],
    ["Subject", 1047793144],
    ["Event", 1047793145],
    ["Media", 1047793146],
    ["Metamap", 1047793147],
    ["Model", 1047793148],
    ["Perspective", 1047793149],
    ["Project", 1047793150],
    ["Status", 1047793151]
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
  findMetacodeByNameOrId: function (nameOrId) {
    var m;
    toExport.metacodes.forEach(function (metacode) {
      if ((typeof nameOrId === 'string' && metacode[0].toLowerCase() === nameOrId.toLowerCase())
          || metacode[1] === nameOrId) m = metacode;
    });
    return m;
  },
  findMetacodeName: function (id) {
    return toExport.findMetacodeByNameOrId(id)[0];
  },
  findMetacodeId: function (name) {
    return toExport.findMetacodeByNameOrId(name)[1];
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
          return callback('mapping failed', topicId);
        }
        var body = JSON.parse(body);
        callback(null, synapseId, body.data.id);
      });
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
    var string = '';

    topics.forEach(function (t) {
      string += t.name + ' (' + toExport.findMetacodeName(t.metacode_id) + ') \n';
    });

    return string;
  },
  formatMapsForDisplay: function (maps, pageData) {
    var mapList = maps.map(function (m) {
      return `- ${m.name}: ${noApiRootUrl}/maps/${m.id} \n`;
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
  mapUrl = rootUrl + '/maps/'; // + ID
  usersUrl = rootUrl + '/users';
  return toExport;
}
