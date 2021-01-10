// Miscellaneous Helper Functions used in the Standard Library

// Caching functions to speed up evaluation of slow redundant operations
var argCache = {}; var usedHashes = {}; var opNumber = 0;

/** Hashes input arguments and checks the cache for that hash.  
 * It returns a copy of the cached object if it exists, but will 
 * call the `cacheMiss()` callback otherwise. The result will be 
 * added to the cache if `GUIState["Cache?"]` is true. */
function CacheOp(args, cacheMiss) {
  //toReturn = cacheMiss();
  postMessage({ "type": "Progress", "payload": { "opNumber": opNumber++, "opType": args.callee.name } }); // Poor Man's Progress Indicator
  let toReturn = null;
  let curHash = ComputeHash(args); usedHashes[curHash] = curHash;
  let check = CheckCache(curHash);
  if (check && GUIState["Cache?"]) {
    //console.log("HIT    "+ ComputeHash(args) +  ", " +ComputeHash(args, true));
    toReturn = new oc.TopoDS_Shape(check);
    toReturn.hash = check.hash;
  } else {
    //console.log("MISSED " + ComputeHash(args) + ", " + ComputeHash(args, true));
    toReturn = cacheMiss();
    toReturn.hash = curHash;
    if (GUIState["Cache?"]) { AddToCache(curHash, toReturn); }
  }
  postMessage({ "type": "Progress", "payload": { "opNumber": opNumber, "opType": null } }); // Poor Man's Progress Indicator
  return toReturn;
}
/** Returns the cached object if it exists, or null otherwise. */
function CheckCache(hash) { return argCache[hash] || null; }
/** Adds this `shape` to the cache, indexable by `hash`. */
function AddToCache(hash, shape) {
  let cacheShape  = new oc.TopoDS_Shape(shape);
  cacheShape.hash = hash; // This is the cached version of the object
  argCache[hash]  = cacheShape;
  return hash;
}

/** This function computes a 32-bit integer hash given a set of `arguments`.  
 * If `raw` is true, the raw set of sanitized arguments will be returned instead. */
function ComputeHash(args, raw) {
  let argsString = JSON.stringify(args);
  argsString = argsString.replace(/(\"ptr\"\:(-?[0-9]*?)\,)/g, '');
  argsString = argsString.replace(/(\"ptr\"\:(-?[0-9]*))/g, '');
  if (argsString.includes("ptr")) { console.error("YOU DONE MESSED UP YOUR REGEX."); }
  let hashString = args.callee.name + argsString;// + GUIState["MeshRes"];
  if (raw) { return hashString; }
  return stringToHash(hashString);
}

// Random Javascript Utilities

/** This function recursively traverses x and calls `callback()` on each subelement. */
function recursiveTraverse(x, callback) {
  if (Object.prototype.toString.call(x) === '[object Array]') {
    x.forEach(function (x1) {
      recursiveTraverse(x1, callback)
    });
  } else if ((typeof x === 'object') && (x !== null)) {
    if (x.HashCode) {
      callback(x);
    } else {
      for (let key in x) {
        if (x.hasOwnProperty(key)) {
          recursiveTraverse(x[key], callback)
        }
      }
    }
  } else {
    callback(x);
  }
}

/** This function returns a version of the `inputArray` without the `objectToRemove`. */
function Remove(inputArray, objectToRemove) {
  return inputArray.filter((el) => {
    return el.hash !== objectToRemove.hash ||
           el.ptr  !== objectToRemove.ptr;
  });
}

/** This function returns true if item is indexable like an array. */
function isArrayLike(item) {
  return (
      Array.isArray(item) || 
      (!!item &&
        typeof item === "object" &&
        item.hasOwnProperty("length") && 
        typeof item.length === "number" && 
        item.length > 0 && 
        (item.length - 1) in item
      )
  );
}

/**  Mega Brittle Line Number Finding algorithm for Handle Backpropagation; only works in Chrome and FF.
 * Eventually this should be replaced with Microsoft's Typescript interpreter, but that's a big dependency...*/
function getCallingLocation() {
  let errorStack = (new Error).stack;
  //console.log(errorStack);
  //console.log(navigator.userAgent);
  let lineAndColumn = [0, 0];
  if (navigator.userAgent.includes("Chrom")) {
    lineAndColumn = errorStack.split("\n")[5].split(", <anonymous>:")[1].split(':');
  }else if (navigator.userAgent.includes("Moz")) {
    lineAndColumn = errorStack.split("\n")[4].split("eval:")[1].split(':');
  } else {
    lineAndColumn[0] = "-1";
    lineAndColumn[1] = "-1";
  }
  lineAndColumn[0] = parseFloat(lineAndColumn[0]);
  lineAndColumn[1] = parseFloat(lineAndColumn[1]);

  return lineAndColumn;
}

/** This function converts either single dimensional 
 * array or a gp_Pnt to a gp_Pnt.  Does not accept 
 * `TopoDS_Vertex`'s yet! */
function convertToPnt(pnt) {
  let point = pnt; // Accept raw gp_Points if we got 'em
  if (point.length) {
    point = new oc.gp_Pnt(point[0], point[1], (point[2])?point[2]:0);
  }
  return point;
}

/** This function converts a string to a 32bit integer. */
function stringToHash(string) { 
    let hash = 0; 
    if (string.length == 0) return hash; 
    for (let i = 0; i < string.length; i++) { 
        let char = string.charCodeAt(i); 
        hash = ((hash << 5) - hash) + char; 
        hash = hash & hash; 
    } 
    return hash; 
}

function CantorPairing(x, y) {
  return ((x + y) * (x + y + 1)) / 2 + y;
}

function normalizeRad(angle) {
  const draft = angle % (Math.PI * 2)
  return draft < Math.PI * 2 ? draft + Math.PI * 2 : draft
}

function deltaAngle({
  fromAngle,
  toAngle,
}) {
  // gives the angle from angleA to B (shortest path)
  // positive number means counterClockwise 🔄
  const normFromAngle = normalizeRad(fromAngle)
  const normToAngle = normalizeRad(toAngle)
  const provisional = normToAngle - normFromAngle
  if (provisional > -Math.PI && provisional <= Math.PI) return provisional

  if (provisional > Math.PI) return provisional - Math.PI * 2
  if (provisional < -Math.PI) return provisional + Math.PI * 2
}


function calculate3PointsForTangentialArc(
  radius,
  angle,
  arcStartPoint,
  previousPoint,
  { arcType = 'shortest', obtuse = true }
) {
  const ang = normalizeRad((angle * Math.PI) / 180)
  const angleOfPreviousLineRad = Math.atan2(
    arcStartPoint.y - previousPoint.y,
    arcStartPoint.x - previousPoint.x
  )
  let clockwise = true
  const temp = deltaAngle({
    fromAngle: angleOfPreviousLineRad,
    toAngle: ang,
  })
  if (['clockwise', 'counterCW'].includes(arcType)) {
    clockwise = arcType === 'clockwise'
  } else {
    if (temp < 0) {
      clockwise = arcType === 'shortest' ? obtuse : !obtuse
    } else {
      clockwise = arcType !== 'shortest' ? obtuse : !obtuse
    }
  }

  const onRightHandSide = clockwise === obtuse
  const angleToCircleCenter = onRightHandSide
    ? angleOfPreviousLineRad - Math.PI / 2
    : angleOfPreviousLineRad + Math.PI / 2
  const circleCenter = {
    x: arcStartPoint.x + Math.cos(angleToCircleCenter) * radius,
    y: arcStartPoint.y + Math.sin(angleToCircleCenter) * radius,
  }
  const angleFromCircleCenter = angleToCircleCenter + Math.PI // flip 180
  const perpendicularAngle = clockwise ? ang + Math.PI / 2 : ang - Math.PI / 2 // angle from the circle center to the final point
  const rotationDirection = deltaAngle({
    fromAngle: angleFromCircleCenter,
    toAngle: perpendicularAngle,
  })
  let midPointAngle = angleFromCircleCenter + rotationDirection / 2
  midPointAngle =
    (clockwise && rotationDirection > 0) ||
    (!clockwise && rotationDirection < 0)
      ? midPointAngle + Math.PI
      : midPointAngle
  midPointAngle = normalizeRad(midPointAngle)
  const onArc = {
    x: circleCenter.x + Math.cos(midPointAngle) * radius,
    y: circleCenter.y + Math.sin(midPointAngle) * radius,
  }
  const endPoint = {
    x: circleCenter.x + Math.cos(perpendicularAngle) * radius,
    y: circleCenter.y + Math.sin(perpendicularAngle) * radius,
  }
  return {
    circleCenter,
    startPoint: arcStartPoint,
    onArc,
    endPoint,
  }
}

function offsetLine(
  offset,
  [x1, y1],
  [x2, y2]
) {
  if (x1 === x2) {
    const direction = Math.sign(y1 - y2)
    return [
      [x1 + offset * direction, y1],
      [x2 + offset * direction, y2],
    ]
  }
  if (y1 === y2) {
    const direction = Math.sign(x2 - x1)
    return [
      [x1, y1 + offset * direction],
      [x2, y2 + offset * direction],
    ]
  }
  const xOffset = offset / Math.sin(Math.atan2(y1 - y2, x1 - x2))
  return [
    [x1 + xOffset, y1],
    [x2 + xOffset, y2],
  ]
}

function calculateIntersectionOfTwoLines({
  line1,
  line2Angle,
  line2Point,
}) {
  const line2PointB = [
    line2Point[0] + Math.cos((line2Angle * Math.PI) / 180) * 10,
    line2Point[1] + Math.sin((line2Angle * Math.PI) / 180) * 10,
  ]
  return intersect(line1[0], line1[1], line2Point, line2PointB)
}

function intersect(
  [x11, y11],
  [x12, y12],
  [x21, y21],
  [x22, y22]
) {
  const slope = ([x1, y1], [x2, y2]) =>
    (y1 - y2) / (x1 - x2)
  const constant = (p1, p2) =>
    p1[1] - slope(p1, p2) * p1[0]
  const getY = (forX, p1, p2) =>
    slope(p1, p2) * forX + constant(p1, p2)

  if (x11 === x12) return [x11, getY(x11, [x21, y21], [x22, y22])]
  if (x21 === x22) return [x21, getY(x21, [x11, y11], [x12, y12])]

  const x =
    (constant([x21, y21], [x22, y22]) - constant([x11, y11], [x12, y12])) /
    (slope([x11, y11], [x12, y12]) - slope([x21, y21], [x22, y22]))
  const y = getY(x, [x11, y11], [x12, y12])
  return [x, y]
}

function intersectionWithParallelLine({
  line1,
  line1Offset,
  line2Angle,
  line2Point,
}) {
  return calculateIntersectionOfTwoLines({
    line1: offsetLine(line1Offset, line1[0], line1[1]),
    line2Angle,
    line2Point,
  })
}

function distanceBetweenPoints(pointA, pointB) {
  return Math.sqrt(
    Math.pow(pointB[1] - pointA[1], 2) + Math.pow(pointB[0] - pointA[0], 2)
  )
}

function getTangentFromPoint({
  point,
  center,
  radius,
  clockwise = true,
}) {
  const distancePointToCenter = distanceBetweenPoints(point, center)

  let deltaAngle = Math.acos(radius / distancePointToCenter)
  if (clockwise) {
    deltaAngle *= -1
  }
  const angleFromCenterToPoint = Math.atan2(
    point[1] - center[1],
    point[0] - center[0]
  )
  const finalAngle = normalizeRad(angleFromCenterToPoint + deltaAngle)
  const tangentPoint = [
    center[0] + Math.cos(finalAngle) * radius,
    center[1] + Math.sin(finalAngle) * radius,
  ]
  const angle =
    (Math.atan2(tangentPoint[1] - point[1], tangentPoint[0] - point[0]) * 180) /
    Math.PI
  return {
    point: tangentPoint,
    angle,
  }
}

function getTangentialPointOfTwoCircles({
  fromCenter,
  fromRadius,
  toCenter,
  toRadius,
  fromClockwise = true,
  toClockwise = true,
}) {
  // Math partly derived from https://gieseanw.wordpress.com/2012/09/12/finding-external-tangent-points-for-two-circles/
  // but only for the non-transverse case.
  const sq = (val) => Math.pow(val, 2)
  const clockwiseSign = toClockwise ? 1 : -1
  const isTransverseTangent = toClockwise !== fromClockwise
  const isTransverseTangentSign = isTransverseTangent ? 1 : -1
  const radiusDiff = Math.abs(toRadius + fromRadius * isTransverseTangentSign)
  const distanceBetweenCenters = distanceBetweenPoints(fromCenter, toCenter)
  const distanceBetweenTangentPoints = Math.sqrt(
    sq(distanceBetweenCenters) - sq(radiusDiff)
  )
  const angleBetweenCenters = Math.atan2(
    toCenter[1] - fromCenter[1],
    toCenter[0] - fromCenter[0]
  )
  const distanceBetweenToCenterAndFromTangent = Math.sqrt(
    sq(toRadius) + sq(distanceBetweenTangentPoints)
  )
  let angleBetweenCircleCentersAndFromCenterToFromTanget = Math.acos(
    (sq(fromRadius) +
      sq(distanceBetweenCenters) -
      sq(distanceBetweenToCenterAndFromTangent)) /
      (2 * fromRadius * distanceBetweenCenters)
  )
  if (isTransverseTangent) {
    angleBetweenCircleCentersAndFromCenterToFromTanget = Math.acos(
      radiusDiff / distanceBetweenCenters
    )
  }
  const angleOfTangentialRadii =
    angleBetweenCircleCentersAndFromCenterToFromTanget * clockwiseSign +
    angleBetweenCenters

  const fromTangent = [
    fromCenter[0] + Math.cos(angleOfTangentialRadii) * fromRadius,
    fromCenter[1] + Math.sin(angleOfTangentialRadii) * fromRadius,
  ]
  const toTangentFlipForTransverseTangent = isTransverseTangent ? Math.PI : 0
  const toTangent = [
    toCenter[0] +
      Math.cos(angleOfTangentialRadii + toTangentFlipForTransverseTangent) *
        toRadius,
    toCenter[1] +
      Math.sin(angleOfTangentialRadii + toTangentFlipForTransverseTangent) *
        toRadius,
  ]
  const AngleOfTangentLine =
    (Math.atan2(toTangent[1] - fromTangent[1], toTangent[0] - fromTangent[0]) *
      180) /
    Math.PI

  return {
    fromTangent,
    toTangent,
    length: distanceBetweenTangentPoints,
    angle: AngleOfTangentLine,
  }
}