import * as _ from 'underscore';

export function waitFor(resourceFn, error, timeoutMilliseconds?, intervalCheckMilliseconds?): Promise<any> {
	if (!timeoutMilliseconds) {
		timeoutMilliseconds = 60 * 1000;
	}
	if (!intervalCheckMilliseconds) {
		intervalCheckMilliseconds = 1000;
	}
	let waitTime = 0;
	return new Promise<any>(function (resolve, reject) {
		function wait() {
			if (resourceFn()) {
				resolve(undefined);
			} else {
				setTimeout(function () {
					waitTime += intervalCheckMilliseconds;
					if (waitTime > timeoutMilliseconds) {
						console.error('waitFor(): waiting tool long for resource: ....: ' + error, error);
					}
					if (timeoutMilliseconds) {
						if (waitTime > timeoutMilliseconds) {
							const msg = 'waitFor(): timeout';
							console.error(msg);
							console.error('resource wait timeout: ', error);
							reject(new Error(msg));
						}
					}
					wait();
				}, 1000);
			}
		}
		wait();
	});
}

export function delayPromise(promise, ms): Promise<any> {
	return new Promise<any>((resolve) => {
		setTimeout(() => {
			resolve(promise);
		}, ms);
	});
}

// Returns deep clone of 'o' removing all blacklisted keys.
// 'Function', 'Date', 'RegExp' a 'Error' object type values are neither cloned nor inspected.

export function deepOmit(o, blackList) {
	function pluck(o) {
		let plucked;
		if (_.isArray(o)) {
			plucked = _.clone(o);
			_.each(plucked, function (v, k) {
				plucked[k] = pluck(v);
			});
		} else if (_.isObject(o) && !(_.isFunction(o) || _.isDate(o) || _.isRegExp(o) || _.isError(o))) {
			plucked = _.omit(o, blackList);
			_.each(plucked, function (v, k) {
				plucked[k] = pluck(v);
			});
		} else {
			plucked = o;
		}
		return plucked;
	}
	const _o = pluck(o);
	return _o;
}

export function rowsToJson(rows): any {
	const o = {};
	_.each(rows, function (v: any) {
		if (v.hasOwnProperty('Key') && v.hasOwnProperty('Value')) {
			o[v.Key] = v.Value;
		} else if (v.hasOwnProperty('key') && v.hasOwnProperty('value')) {
			o[v.key] = v.value;
		} else {
			throw new Error('rowsToJson(): misssing key or value');
		}
	});
	return o;
}

// Clone object. 'Function', 'Date', 'RegExp' a 'Error' object type values are not cloned.

export function clone(obj) {
	if (obj === null || typeof obj !== 'object' || _.isFunction(obj) || _.isDate(obj) || _.isRegExp(obj) || _.isError(obj)) {
		return obj;
	}

	const temp = obj.constructor();
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			temp[key] = clone(obj[key]);
		}
	}

	return temp;
}

export function rxPromise(observable): Promise<any> {
	return new Promise<any>((resolve, reject) => {
		observable.subscribe(
			(val) => {
				resolve(val);
			},
			(err) => {
				reject(err);
			}
		);
	});
}

export function sequenecePromises(arr, promiseFn, chunkSize, fn): Promise<any> {
	return new Promise<any>((resolve, reject) => {
		let result = [];

		let n = 0;
		let chunk = arr.slice(n, chunkSize);
		let promise = delayPromise(Promise.all(chunk.map(promiseFn)), 1);

		function wait(promise, n) {
			promise.then(
				(vs) => {
					if (vs.length > 0) {
						result = result.concat(vs.filter((v) => v));
						fn(result.length);

						n += vs.length;
						let chunk = arr.slice(n, n + chunkSize);
						let promise = delayPromise(Promise.all(chunk.map(promiseFn)), 1);

						wait(promise, n);
					} else {
						resolve(result);
					}
				},
				(err) => reject(err)
			);
		}
		wait(promise, n);
	});
}

export function eitherPromise(p1: Promise<any>, p2: Promise<any>): Promise<any> {
	return new Promise((resolve, reject) => {
		p1.then(
			(v) => resolve(v),
			(err) => reject(err)
		);
		p2.then(
			(v) => resolve(v),
			(err) => reject(err)
		);
	});
}

export function sleep(milliseconds): Promise<any> {
	return new Promise<any>((resolve) => {
		setTimeout(function () {
			resolve(undefined);
		}, milliseconds);
	});
}

export type EnumList<T> = T[];
export interface EnumSelectBoxItem<T> {
	id: T;
	name: string;
}
export type EnumSelectBoxList<T> = EnumSelectBoxItem<T>[];

export function enumListToSelectBoxList<T>(list: EnumList<T>): EnumSelectBoxList<T> {
	return list.map((v: T) => {
		return {
			id: v,
			name: '' + v,
		};
	});
}

export function makeBasicAuthHeaderValue(user, password) {
	let tok = user + ':' + password;
	let hash = btoa(tok);
	return 'Basic ' + hash;
}
