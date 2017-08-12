var geohash = require('geohasher').encode
var neigh = require('geohasher').calculateAdjacent
var through = require('through2')
var haversine = require('haversine')

module.exports = Db

// TODO: support multiple points @ same geohash
function Db (lvl) {
  if (!(this instanceof Db)) return new Db(lvl)

  this.db = lvl
}

Db.prototype.insert = function (pt, cb) {
  var hash = geohash(pt[0], pt[1])
  this.db.put(hash, pt[0] + ',' + pt[1], cb)
}

// distance in km
Db.prototype.queryStream = function (near, distance) {
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

Db.prototype.queryStream8 = function (near, distance) {
  var res = through.obj(write, end)

  var nearHash = geohash(near[0], near[1])
  var prefixLen = this.distanceToHashLength(distance)
  var prefix = nearHash.substring(0, prefixLen)

  this._neighbourStream(prefix, 'west').pipe(res)
  this._neighbourStream(prefix, 'east').pipe(res)
  this._neighbourStream(prefix, 'west').pipe(res)
  this._neighbourStream(prefix, 'north').pipe(res)
  this._neighbourStream(prefix, 'south').pipe(res)
  this._neighbourStream(prefix, 'northeast').pipe(res)
  this._neighbourStream(prefix, 'northwest').pipe(res)
  this._neighbourStream(prefix, 'southeast').pipe(res)
  this._neighbourStream(prefix, 'southwest').pipe(res)

  var dedupe = {}
  var total = 0
  var passed = 0
  function write (pt, enc, next) {
    total++
    if (dedupe[pt.key]) return next()
    dedupe[pt.key] = true
    passed++
    if (haversineDistanceKm(near, pt.value.split(',')) >= distance) return next()
    next(null, pt)
  }
  function end(done) {
    console.log('filtered', total-passed, 'out of', total)
    done()
  }

  return res
}

Db.prototype.distanceToHashLength = function (dist) {
  if (dist >= 2500) return 1
  else if (dist >= 630) return 2
  else if (dist >= 78) return 3
  else if (dist >= 20) return 4
  else if (dist >= 2.4) return 5
  else if (dist >= 0.61) return 6
  else if (dist >= 0.076) return 7
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
