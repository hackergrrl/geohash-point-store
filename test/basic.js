var test = require('tape')
var level = require('memdb')
var haversine = require('haversine')
var Db = require('..')

// TODO: test case where two different points map to the same geohash -- does everything break?

test('many random points', function (t) {
  var db = Db(level())

  var expected = {}
  var at = [0.3, 0.3]

  var n = 50000
  var spread = 1
  var pending = n
  function insert () {
    if (!pending) return check()
    var x = 0.5 + Math.random() * spread - spread/2
    var y = 0.5 + Math.random() * spread - spread/2

    if (haversineDistanceKm(at, [x, y]) <= 1) {
      var str = [x, y].join(',')
      expected[str] = true
    }

    db.insert([x, y], 'x', function () {
      pending--
      insert()
    })
  }
  insert()

  function check () {
    var q = db.queryStream(at, 1)
    var matches = 0
    q.on('data', function (pt) {
      var at = pt.lat + ',' + pt.lon
      if (expected[at]) matches++
    })
    q.once('end', function () {
      t.equal(Object.keys(expected).length, matches)
      t.end()
    })
  }
})

function haversineDistanceKm (from, to) {
  var from = {
    latitude: from[0],
    longitude: from[1]
  }
  var to = {
    latitude: to[0],
    longitude: to[1]
  }
  return haversine(from, to, {unit: 'meter'}) / 1000
}
