// Miscellaneous Helper Functions used in the Standard Library

// Caching functions to speed up evaluation of slow redundant operations
var argCache: { [hash: number] : oc.TopoDS_Shape } = {};
var usedHashes = {}; var opNumber : number = 0;


/** Explicitly Cache the result of this operation so that it can 
 * return instantly next time it is called with the same arguments.
 * Hashes input arguments and checks the cache for that hash.  
 * It returns a copy of the cached object if it exists, but will 
 * call the `cacheMiss()` callback otherwise. The result will be 
 * added to the cache if `GUIState["Cache?"]` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let box = CacheOp(arguments, () => { return new oc.BRepPrimAPI_MakeBox(x, y, z).Shape(); });``` */
function CacheOp(args: IArguments, cacheMiss: () => oc.TopoDS_Shape): oc.TopoDS_Shape {
  //toReturn = cacheMiss();
  postMessage({ "type": "Progress", "payload": { "opNumber": opNumber++, "opType": args.callee.name } }, null); // Poor Man's Progress Indicator
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
  postMessage({ "type": "Progress", "payload": { "opNumber": opNumber, "opType": null } }, null); // Poor Man's Progress Indicator
  return toReturn;
}
/** Returns the cached object if it exists, or null otherwise. */
function CheckCache(hash : number) : oc.TopoDS_Shape|null { return argCache[hash] || null; }
/** Adds this `shape` to the cache, indexable by `hash`.  Returns the hash. */
function AddToCache(hash : number, shape : oc.TopoDS_Shape) : number {
  let cacheShape  = new oc.TopoDS_Shape(shape);
  cacheShape.hash = hash; // This is the cached version of the object
  argCache[hash]  = cacheShape;
  return hash;
}

/** This function computes a 32-bit integer hash given a set of `arguments`.  
 * If `raw` is true, the raw set of sanitized arguments will be returned instead. */
function ComputeHash(args : IArguments, raw ?: boolean) : number|string {
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
function recursiveTraverse(x : any, callback : ((x:any)=>any)) : void {
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
function Remove(inputArray: any[], objectToRemove : any) : any[] {
  return inputArray.filter((el) => {
    return el.hash !== objectToRemove.hash ||
           el.ptr  !== objectToRemove.ptr;
  });
}

/** This function returns true if item is indexable like an array. */
function isArrayLike(item : any) : boolean {
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
function getCallingLocation() : number[] {
  let errorStack = (new Error).stack;
  //console.log(errorStack);
  //console.log(navigator.userAgent);
  let lineAndColumnStr = ["0", "0"];
  if (navigator.userAgent.includes("Chrom")) {
    lineAndColumnStr = errorStack.split("\n")[5].split(", <anonymous>:")[1].split(':');
  }else if (navigator.userAgent.includes("Moz")) {
    lineAndColumnStr = errorStack.split("\n")[4].split("eval:")[1].split(':');
  } else {
    lineAndColumnStr[0] = "-1";
    lineAndColumnStr[1] = "-1";
  }
  let lineAndColumn = [0, 0];
  lineAndColumn[0] = parseFloat(lineAndColumnStr[0]);
  lineAndColumn[1] = parseFloat(lineAndColumnStr[1]);

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
function stringToHash(string: string) : number { 
    let hash = 0; 
    if (string.length == 0) return hash; 
    for (let i = 0; i < string.length; i++) { 
        let char = string.charCodeAt(i); 
        hash = ((hash << 5) - hash) + char; 
        hash = hash & hash; 
    } 
    return hash; 
}

/** This function hashes two numbers together. */
function CantorPairing(x : number, y : number) : number {
  return ((x + y) * (x + y + 1)) / 2 + y;
}
