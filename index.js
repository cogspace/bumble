var http = require('http');
var fs = require('fs');
var EasyZip = require('easy-zip').EasyZip;

var BASE_URL = 'http://webservices.nextbus.com/service/publicJSONFeed';

var OUTPUT_FILE = 'google_transit.zip';
var AGENCY_FILE = 'agency.txt';
var STOPS_FILE = 'stops.txt';
var ROUTES_FILE = 'routes.txt';
var TRIPS_FILE = 'trips.txt';
var STOP_TIMES_FILE = 'stop_times.txt';
var CALENDAR_FILE = 'calendar.txt';

var sc = {};

var today = new Date();
var START_DATE = '' + today.getFullYear() + (today.getMonth() + 1) + today.getDate();
var END_DATE = '' + (today.getFullYear() + 5) + (today.getMonth() + 1) + today.getDate();

function url(cmd, args) {
  var u = BASE_URL + '?command=' + cmd;
  for(var key in args) {
    u += '&' + key;
    if (args[key] != null) {
      u += '=' + args[key];
    }
  }
  return u;
}

function csv(data, columns) {
  if (columns == undefined) {
    columns = [];
    for (var key in data[0]) {
      columns.push(key);
    }
  }

  var s = '';
  s += columns.join(',') + '\n';
  data.forEach(function(datum) {
    var line = [];
    columns.forEach(function(column) {
      line.push(datum[column]);
    });
    s += line.join(',') + '\n';
  });
  return s;
}

function fetch(url, callback) {
  http.get(url, function(response) {
    var data = '';
    response.on('data', function(chunk) {
      data += chunk.toString();
    });
    response.on('end', function() {
      callback(JSON.parse(data));
    });
  });
}

// TODO do all agencies?
var agencyName = 'glendale';

var stopMap = {};

var agency = [{
  agency_name: 'Glendale Beeline',
  agency_url: 'http://www.glendaleca.gov/government/departments/public-works/public-transportation/beeline-transit-system',
  agency_timezone: 'America/Los_Angeles',
  agency_phone: '818-548-3960',
}];
var stops = [];
var routes = [];
var trips = [];
var stop_times = [];
var calendar = [{
  service_id: 'wkd',
  monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 0, sunday: 0,
  start_date: START_DATE, end_date: END_DATE
}, {
  service_id: 'sat',
  monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 1, sunday: 0,
  start_date: START_DATE, end_date: END_DATE
}, {
  service_id: 'sun',
  monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 1,
  start_date: START_DATE, end_date: END_DATE
}];

fetch(url('routeConfig', {a: agencyName, terse: null}), function(data) {
  var todo = data.route.length;
  data.route.forEach(function(route) {
    fetch(url('schedule', {a: agencyName, r: route.tag}), function(schedule) {
      route.stop.forEach(function(stop) {
        stopMap[stop.tag] = stop;
      });

      var serviceClasses = {};

      schedule.route.forEach(function(trip) {
        serviceClasses[trip.direction] = trip.serviceClass;
        sc[trip.serviceClass] = 1;
        var sequence = 0;
        trip.tr.forEach(function(block) {
          block.stop.forEach(function(stop) {
            stop_times.push({
              trip_id: trip.direction,
              arrival_time: stop.content,
              departure_time: stop.content,
              stop_id: stop.tag,
              stop_sequence: sequence,
            });
          });
        });
      });

      route.direction.forEach(function(direction, i) {
        trips.push({
          route_id: route.tag,
          service_id: serviceClasses[direction.tag],
          trip_id: direction.tag,
          trip_headsign: direction.title,
          direction_id: i,
        });
      });

      routes.push({
        route_id: route.tag,
        route_short_name: route.tag,
        route_long_name: route.title,
        route_type: 3,
        route_color: route.color,
        route_text_color: route.oppositeColor,
      });

      if (--todo == 0) {
        for (var key in stopMap) {
          var stop = stopMap[key];
          stops.push({
            stop_id: stop.tag,
            stop_name: stop.title,
            stop_lat: stop.lat,
            stop_lon: stop.lon,
          });
        }

        var zip = new EasyZip();
        zip.file(AGENCY_FILE, csv(agency));
        zip.file(STOPS_FILE, csv(stops));
        zip.file(ROUTES_FILE, csv(routes));
        zip.file(TRIPS_FILE, csv(trips));
        zip.file(STOP_TIMES_FILE, csv(stop_times));
        zip.file(CALENDAR_FILE, csv(calendar));
        zip.writeToFile(OUTPUT_FILE);
      }
    });
  });
});
