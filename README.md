# geohash-point-store

> Store and query spatial points using geohashes and LevelDB.

Uses [geohashing](https://en.wikipedia.org/wiki/Geohash) to index points for
fast storage and querying.

## Usage

```js
var Geostore = require('geohash-point-store')
var memdb = require('memdb')

var levelDb = memdb()
var store = Geostore(levelDb)

var n = 1000
var spread = 0.2  // 0.2 of lat/lon is about 20km
var pending = n
function insert () {
  if (!--pending) return query()
  var x = 0.3 + Math.random() * spread - spread/2
  var y = 0.3 + Math.random() * spread - spread/2
  var value = Math.random().toString().substring(2, 4)
  db.insert([x, y], value, insert)
}
insert()

function query () {
  var at = [0.3, 0.3]
  var q = db.queryStream8(at, 1)  // 1km
  q.on('data', function (pt) {
    console.log('Q', pt)
  })
}
```

outputs

```
Q { lat: 0.29634207747112706, lon: 0.2993872801415114, value: '38' }
Q { lat: 0.3068307609860095, lon: 0.295966883616435, value: '73' }
Q { lat: 0.2981759863251534, lon: 0.29876116341017966, value: '78' }
Q { lat: 0.3029278595931988, lon: 0.2977136462590203, value: '57' }
```

## API

```js
var Geostore = require('geohash-point-store')
```

### var store = Geostore(db)

Create a new point store, using the
[LevelUP](https://www.npmjs.com/package/levelup) instance `db` for storage.

### store.insert(pt, value, cb)

Insert `value` (and JSON serializable object) at point `pt`. `pt` must be an
array of the form `[latitude, longitude]`.

### var readstream = store.queryStream(at, distance)

Query for all points around point `at` (an array of `[lat, lon]`) that are
within distance `distance`, in kilometres.

Returns a readable stream of points of the form `{ lat: ?, lon: ?, value: ? }`.

## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install geohash-point-store
```

## See Also

- [level-places](https://github.com/Wayla/level-places)
- [kdb-tree-store](https://github.com/peermaps/kdb-tree-store)

## License

ISC

