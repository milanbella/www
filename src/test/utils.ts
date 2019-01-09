import { _ } from 'underscore';

import { promiseResolve } from '../app/common/utils';


/* Defines test named 'name'. 'fn' is the actual function drfining the test. 'fn' must return a promise, if the promise
  is resolved then test succeeded, if promise is rejected then test failed.
   Returns the test definition.
*/

export function defineTest (name: string, fn: any) : any {
	return {
		name: name,
		fn: fn
	};
}

/* Run the set of tests named 'name'. 'tests' is array containing test definitions returned by defineTest() */

export function runTests (name, tests) {

	console.log('tests: ' + name);

	var stats = [];

	function doTest (tests, stats) : Promise<any> {
		var t = _.first(tests);
		tests = _.rest(tests);
		if (t) {
			console.log('test: ' + t.name);
			return t.fn().then(function () {
				console.log('success: ' + t.name);
				return {
					name: t.name,
					ok: true,
					err: null
				};
			}, function (err) {
				console.error('failed: ' + t.name);
				console.dir(err);
				return {
					name: t.name,
					ok: false,
					err: err
				};
			})
			.then(function (stat) {
				stats.push(stat);
				return stat;
			}, function (stat) {
				stats.push(stat);
				return stat;
			})
			.then(function (stat) {
				if (!stat.ok) {
					if (stat.err instanceof Error) {
						throw stat.err;
					}
				}
			})
			.then(function () {
				return doTest(tests, stats);
			});
		} else {
			return promiseResolve(stats);
		}
	}


	doTest(tests, stats).then(function (stats) {
		console.log('STATISTICS: ' + name);
		function report () {
			var stat = _.first(stats);
			stats = _.rest(stats);
			if (stat) {
				if (stat.ok) {
					console.log(stat.name + ': ' + 'success');
				} else {
					console.error(stat.name + ': ' + 'failed');
					console.dir(stat.err);
				}
				report();
			}
		}
		report();
	});

}

