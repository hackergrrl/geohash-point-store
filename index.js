var geohash = require('geohasher').encode
var neigh = require('geohasher').calculateAdjacent
var through = require('through2')
var haversine = require('haversine')

module.exports = Db

// TODO: support 'remove' operation (by point)
// TODO: support multiple points @ same geohash
function Db (lvl) {
  if (!(this instanceof Db)) return new Db(lvl)

  this.db = lvl
}

Db.prototype.insert = function (pt, value, cb) {
  var hash = geohash(pt[0], pt[1])
  var v = {
    lat: pt[0],
    lon: pt[1],
    value: value
  }
  this.db.put(hash, JSON.stringify(v), cb)
}

// distance in km
Db.prototype._queryStream = function (near, distance) {
  near = geohash(near[0], near[1])
  var prefixLen = this.distanceToHashLength(distance)
  var prefix = near.substring(0, prefixLen)
  return this.db.createReadStream({
    gt: prefix,
    lt: prefix + '~'
  })
}

Db.prototype._neighbourStream = function (at, dir) {
  var prefix = neighbourFromDir(at, dir)
  return this.db.createReadStream({
    gt: prefix,
    lt: prefix + '~'
  })
}

function neighbourFromDir (at, dir) {
  switch (dir) {
    case 'east': return neigh(at, 'right')
    case 'west': return neigh(at, 'left')
    case 'north': return neigh(at, 'top')
    case 'south': return neigh(at, 'bottom')
    case 'northeast': return neigh(neigh(at, 'right'), 'top')
    case 'northwest': return neigh(neigh(at, 'left'), 'top')
    case 'southeast': return neigh(neigh(at, 'right'), 'bottom')
    case 'southwest': return neigh(neigh(at, 'left'), 'bottom')
    default: throw Error('unknown dir: ' + dir)
  }
}

function fakePipe (from, to) {
  if (!to.pending) to.pending = 0
  to.pending++
  from.on('data', function (data) {
    to.write(data)
  })
  from.on('end', function () {
    if (--to.pending === 0) {
      to.end()
    }
  })
}

// Query the geoarea at 'near', but also all neighbours in 8 directions.
Db.prototype.queryStream = function (near, distance) {
  var res = through.obj(write, end)

  var nearHash = geohash(near[0], near[1])
  var prefixLen = this.distanceToHashLength(distance)
  var prefix = nearHash.substring(0, prefixLen)

  fakePipe(this._queryStream(near, distance), res)
  fakePipe(this._neighbourStream(prefix, 'west'), res)
  fakePipe(this._neighbourStream(prefix, 'east'), res)
  fakePipe(this._neighbourStream(prefix, 'west'), res)
  fakePipe(this._neighbourStream(prefix, 'north'), res)
  fakePipe(this._neighbourStream(prefix, 'south'), res)
  fakePipe(this._neighbourStream(prefix, 'northeast'), res)
  fakePipe(this._neighbourStream(prefix, 'northwest'), res)
  fakePipe(this._neighbourStream(prefix, 'southeast'), res)
  fakePipe(this._neighbourStream(prefix, 'southwest'), res)

  var dedupe = {}
  function write (pt, enc, next) {
    if (dedupe[pt.key]) return next()
    dedupe[pt.key] = true
    var res = JSON.parse(pt.value)
    if (haversineDistanceKm(near, [res.lat, res.lon]) >= distance) return next()
    next(null, res)
  }
  function end(done) {
    done()
  }

  return res
}

Db.prototype.distanceToHashLength = function (dist) {
  if (dist >= 2500) return 1
  else if (dist >= 630) return 1
  else if (dist >= 78) return 2
  else if (dist >= 20) return 3
  else if (dist >= 2.4) return 4
  else if (dist >= 0.61) return 5
  else if (dist >= 0.076) return 6
  else return 8
}

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
