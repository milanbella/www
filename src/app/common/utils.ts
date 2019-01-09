import  { _ } from 'underscore';

// Cast regular js promise to Promise<any>
//
export function toPromise (v) : Promise<any> {
	if (v && (typeof v.then === 'function')) {
		return new Promise<any>(function (resolve, reject) {
			v.then(function (v) {
				resolve(v);
			}, function (err) {
				reject(err);
			});
		});
	} else {
		return promiseResolve(v);
	}
}

export function newPromise (resolver) : Promise<any> {
	function _resolver (resolve, reject) {
		try {
			resolver(resolve, reject);
		} catch (err) {
			console.error(err);
			reject(err);
		}
	}
	return new Promise<any>(_resolver);
}

export function promiseResolve (v?) : Promise<any> {
	return new Promise<any>(function (resolve, reject) {
		return resolve(v);
	});
}

export function promiseReject (err?) : Promise<any> {
	return new Promise<any>(function (resolve, reject) {
		return reject(err);
	});
}

// Joins all promises. Resolves with array of results if all promises resolved or failes immeditatelly with error if any of promises rejected. (see angular1: $q.all())

export function promiseAll (promises: any[]) : Promise<any>  {
	var n = promises.length;
	return new Promise<any>(function (resolve, reject) {
		var arr = [];
		if (n === 0) {
			resolve(arr);
		} else {
			_.each(promises, function (promise, i) {
				promise.then(function (v) {
					arr[i] = v;
					--n;
					if (n === 0) {
						resolve(arr);
					}
				}, function (err) {
					reject(err);
				});
			});
		}
	});
}

// generatorFn() must return promise or null.
// Executes sequence of promises each promise being generated  by call to generator generatorFn(). End
// of sequence of promises is signalled by null return value from generatorFn().

export function sequenceOfPromises (generatorFn, ctx?) : Promise<any> {
	function _seq(error, i) :  Promise<any> {
		var promise = generatorFn(i, ctx);
		if (promise) {
			return promise.then(function () {
				return _seq(error, i+1);
			}, function (err) {
				console.error('error in generatorFn:');
				console.dir(err);
				return _seq(err, i+1);
			});
		} else {
			return new Promise<any>(function (resolve, reject) {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		}
	}
	return _seq(null, 0);
}

// generatorFn() must return promise or null. conditionFn() is passed the resolved value from promise in sequence.
// Executes sequence of promises each promise being generated  by call to generator generatorFn(). End
// of sequence of promises is signaled by falsy value returned by conditionFn() or null return value from generatorFn().

export function sequenceOfPromisesUntillValue (generatorFn, conditionFn, ctx?) : Promise<any> {
	function _seq(error, i) : Promise<any> {
		var promise = generatorFn(i, ctx);
		if (promise) {
			return promise.then(function (value) {
				if (conditionFn(value)) {
					if (error) {
						return promiseReject(error);
					}
					return;
				} else {
					return _seq(error, i+1);
				}
			}, function (err) {
				return _seq(err, i+1);
			});
		} else {
			return new Promise<any>(function (resolve, reject) {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		}
	}
	return _seq(null, 0);
}

export function waitFor (resourceFn, timeoutMilliseconds?, intervalCheckMilliseconds?) : Promise<any> {
	if (!intervalCheckMilliseconds) {
		intervalCheckMilliseconds = 1000;
	}
	var waitTime = 0;
	return new Promise<any> (function (resolve, reject) {
		function wait () {
			if (resourceFn()) {
				resolve();
			} else {
				setTimeout(function () {
					waitTime += intervalCheckMilliseconds;
					if (waitTime > 60 * 1000) {
						console.error('waitFor(): waiting tool long for resource ....');
					}
					if (timeoutMilliseconds) {
						if (waitTime > timeoutMilliseconds) {
							console.error('waitFor(): timeout');
							reject(new Error('waitFor(): timeout'));
						}
						
					}
					wait();
				}, 1000)
			}
		}
		wait();
	})
}

// Returns deep clone of 'o' removing all blacklisted keys.

export function deepOmit (o, blackList) {

	function pluck (o) {
		var plucked =  _.omit(o, blackList);
		_.each(plucked, function(v, k) {

			// apply pluck only on nested objects
			if(_.isObject(plucked[k])){
				plucked[k] = pluck(v);
			}

		});
		return plucked;
	}
	var _o = pluck(o);
	return _o;
}

export function rowsToJson(rows) {
	var o = {};
	_.each(rows, function (v) {
		o[v.Key] = v.Value;
	});
	return o;
}

// Clone object

export function clone(obj) {

	if (obj === null || typeof obj !== 'object') {
		return obj;
	}

	var temp = obj.constructor();
	for (var key in obj) {
		temp[key] = clone(obj[key]);
	}

	return temp;
}

export function rxPromise (observable) : Promise<any> {
	return new Promise<any> ((resolve, reject) => {
		observable.subscribe((val) => {
			resolve(val);
		}, (err) => {
			reject(err);
		});
	});
}

export function sleep (milliseconds) : Promise<any> {
	return new Promise<any> ((resolve, reject) => {
		setTimeout(function () {
			resolve();
		}, milliseconds);
	})
}
