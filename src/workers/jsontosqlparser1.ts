import { clone } from '../common/utils';
import { settings } from './workerCtx';

import * as _ from 'underscore';

export function parseSQSMessageToSQL(message) {
	let msg = JSON.parse(message);
	if (settings.settings.isDebug && settings.settings.isDebugMessageParsing) {
		console.log('replication: processMessages:  parsing message:');
		console.dir(msg);
	}

	let records = getRecords(msg);
	let sqls = [];
	for (let i = 0; i < records.length; i++) {
		let arr = generateSQLstatemens(records[i]);
		sqls.push(arr[0]);
		sqls.push(arr[1]);
	}
	return sqls;
}

export function parseMessageForIndexedDb(message) {
	let msg = JSON.parse(message);
	if (settings.settings.isDebug && settings.settings.isDebugMessageParsing) {
		console.log('replication: processMessages:  parsing message:');
		console.dir(msg);
	}

	let records = getRecords(msg);
	records = records.reduce((a, record) => {
		a.push(generateIndexedDbRecord(record));
		return a;
	}, []);
	return records;
}

function getRecords(msg) {
	// Walk through records tree in 'o' and fill in 'records' array cotaining topologically sorted records
	function walk(o, records) {
		let record;
		if (o.hasOwnProperty('DataType')) {
			if (!_.isString(o.DataType)) {
				console.error('jsontosqlparser: getRecords: unknow data type');
				console.dir(o);
				throw new Error('jsontosqlparser: getRecords: unknow data type:' + JSON.stringify(o));
			}
			if (o.DataType.toLowerCase() === 'list') {
				_.each(o, function (v, k: any) {
					if (k !== 'DataType') {
						walk(v, records);
					}
				});
			} else if (o.DataType.toLowerCase() === 'record') {
				record = {};
				_.each(o, function (v, k: any) {
					if (k !== 'DataType' && !_.isArray(v)) {
						// 'DataType' key is just metadata, its not record item
						// key with value of type array is foreign key reverence, array conteins records having forign key in this current record
						record[k] = v;
					}
				});
				records.push(record);
				_.each(o, function (v, k: any) {
					if (k !== 'DataType') {
						// notice: that we recurse into key with value type array  to parse out freign records as well
						walk(v, records);
					}
				});
			} else if (o.DataType.toLowerCase() === 'date') {
				return;
			} else {
				console.error('unknown data type');
			}
		} else {
			if (_.isArray(o) || _.isObject(o)) {
				_.each(o, function (v) {
					walk(v, records);
				});
			} else {
				return;
			}
		}
	}

	let records = [];
	let _msg = clone(msg);
	walk(_msg, records);
	records = convertJsPrimitiveValues(records);
	if (settings.settings.isDebug && settings.settings.isDebugMessageParsing) {
		console.log('jsontosqlparser: getRecords: records:');
		console.dir(records);
	}
	return records;
}

function isMetaKey(key) {
	let k = key.toLowerCase();
	let m = _.find(['DataType', 'ReplicationType', 'WebContext', 'Version', 'AD_Client_Value', 'AD_Table', 'AD_Column_ID', 'ReplicationEvent', 'TabLevel', 'ReplicationMode', 'TargetType', 'PrimaryKey'], function (n) {
		return k === n.toLowerCase();
	});
	if (m) {
		return true;
	} else {
		return false;
	}
}

function convertJsPrimitiveValues(records) {
	return _.map(records, function (record: any) {
		return _.reduce(
			record,
			function (r, v, k) {
				if (isMetaKey(k)) {
					r[k] = v;
					return r;
				}
				if (typeof v === 'boolean') {
					if (v) {
						r[k] = 'Y';
					} else {
						r[k] = 'N';
					}
				} else if (typeof v === 'string') {
					r[k] = v.replace(`'`, `''`);
				} else {
					r[k] = v;
				}
				return r;
			},
			{}
		);
	});
}

function sqlStatementToString(statement) {
	let vals = _.reduce(
		statement[1],
		function (a, v, i) {
			if (i < statement[1].length - 1) {
				a += v + ',';
			} else {
				a += v;
			}
			return a;
		},
		''
	);
	return statement[0] + ' [' + vals + ']';
}

function pad2(n) {
	return (n < 10 ? '0' : '') + n;
}

function generateIndexedDbRecord(record) {
	let tableName = record.AD_Table;
	if (!tableName) {
		console.error('jsontosqlparser: generateIndexedDbRecord: missing table name');
		console.dir(record);
		throw new Error('jsontosqlparser: generateIndexedDbRecord: missing table name: ' + JSON.stringify(record));
	}

	let primaryKey = [];
	if (record.PrimaryKey) {
		if (!_.isString(record.PrimaryKey)) {
			console.error('jsontosqlparser: generateIndexedDbRecord: PrimaryKey value is not string');
			console.dir(record);
			throw new Error('jsontosqlparser: generateIndexedDbRecord: PrimaryKey value is not string' + JSON.stringify(record));
		}
		primaryKey = record.PrimaryKey.split(',');
		primaryKey = _.filter(primaryKey, function (v) {
			return v.trim !== '';
		});
	} else if (record.AD_Column_ID) {
		primaryKey.push(record.AD_Column_ID);
	}
	if (primaryKey.length < 1) {
		console.error('jsontosqlparser: generateIndexedDbRecord: could not determine primary key');
		console.dir(record);
		throw new Error('jsontosqlparser: generateIndexedDbRecord: could not determine primary key: ' + JSON.stringify(record));
	}

	let columns = [];
	columns = _.map(record, function (v, k) {
		return {
			name: k,
			value: v,
		};
	});

	columns = _.filter(columns, function (c) {
		return !isMetaKey(c.name);
	});
	if (columns.length < 1) {
		console.error('jsontosqlparser: generateIndexedDbRecord: missing columns');
		console.dir(record);
		throw new Error('jsontosqlparser: generateIndexedDbRecord: missing columns:' + JSON.stringify(record));
	}

	// convert specially typed values to js primitive types
	columns = _.map(columns, function (c) {
		if (c.value.DataType) {
			if (!_.isString(c.value.DataType)) {
				console.error('jsontosqlparser: generateIndexedDbRecord: unknow data type');
				console.dir(record);
				throw new Error('jsontosqlparser: generateIndexedDbRecord: unknow data type:' + JSON.stringify(record));
			}
			if (c.value.DataType.toLowerCase() === 'date') {
				c.value = new Date(c.value.content);
				return c;
			} else {
				console.error('jsontosqlparser: generateIndexedDbRecord: unknow data type: ' + c.value.DataType);
				console.dir(record);
				throw new Error('jsontosqlparser: generateIndexedDbRecord: unknow data type: ' + c.value.DataType + ' : ' + JSON.stringify(record));
			}
		} else {
			return c;
		}
	});

	return {
		storeName: tableName.toLowerCase(),
		key: primaryKey.map((key) => {
			return key.toLowerCase();
		}),
		value: columns.reduce((a, column) => {
			a[column.name.toLowerCase()] = column.value;
			return a;
		}, {}),
	};
}

function generateSQLstatemens(record) {
	let tableName = record.AD_Table;
	if (!tableName) {
		console.error('jsontosqlparser: generateSQL: missing table name');
		console.dir(record);
		throw new Error('jsontosqlparser: generateSQL: missing table name: ' + JSON.stringify(record));
	}

	let primaryKey = [];
	if (record.PrimaryKey) {
		if (!_.isString(record.PrimaryKey)) {
			console.error('jsontosqlparser: generateSQL: PrimaryKey value is not string');
			console.dir(record);
			throw new Error('jsontosqlparser: generateSQL: PrimaryKey value is not string' + JSON.stringify(record));
		}
		primaryKey = record.PrimaryKey.split(',');
		primaryKey = _.filter(primaryKey, function (v) {
			return v.trim !== '';
		});
	} else if (record.AD_Column_ID) {
		primaryKey.push(record.AD_Column_ID);
	}
	if (primaryKey.length < 1) {
		console.error('jsontosqlparser: generateSQL: could not determine primary key');
		console.dir(record);
		throw new Error('jsontosqlparser: generateSQL: could not determine primary key: ' + JSON.stringify(record));
	}

	let columns = [];
	columns = _.map(record, function (v, k) {
		return {
			name: k,
			value: v,
		};
	});
	/*
	columns = _.filter(columns, function (c) {
		let name = c.name.toLowerCase();
		return !_.find(['DataType', 'ReplicationType', 'WebContext', 'Version', 'AD_Client_Value', 'AD_Table', 'AD_Column_ID', 'ReplicationEvent', 'TabLevel', 'ReplicationMode', 'TargetType', 'PrimaryKey'], function (n) {
			return name === n.toLowerCase();
		});
	});
	 */
	columns = _.filter(columns, function (c) {
		return !isMetaKey(c.name);
	});
	if (columns.length < 1) {
		console.error('jsontosqlparser: generateSQL: missing columns');
		console.dir(record);
		throw new Error('jsontosqlparser: generateSQL: missing columns:' + JSON.stringify(record));
	}

	// convert specially typed values to js primitive types

	columns = _.map(columns, function (c) {
		if (c.value.DataType) {
			if (!_.isString(c.value.DataType)) {
				console.error('jsontosqlparser: generateSQL: unknow data type');
				console.dir(record);
				throw new Error('jsontosqlparser: generateSQL: unknow data type:' + JSON.stringify(record));
			}
			if (c.value.DataType.toLowerCase() === 'date') {
				let d = new Date(c.value.content);

				c.value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
				return c;
			} else {
				console.error('jsontosqlparser: generateSQL: unknow data type: ' + c.value.DataType);
				console.dir(record);
				throw new Error('jsontosqlparser: generateSQL: unknow data type: ' + c.value.DataType + ' : ' + JSON.stringify(record));
			}
		} else {
			return c;
		}
	});

	let statemens: any = {};

	let stmtTable = tableName;
	let stmtColumns = '';
	let stmtValues = '';
	let stmtWhere = '';
	let parameterValues = [];

	// geneate insert sql statement

	_.each(columns, function (c, i) {
		stmtColumns += c.name;
		stmtValues += '?';
		if (i < columns.length - 1) {
			stmtColumns += ',';
			stmtValues += ',';
		}
		parameterValues.push(c.value);
	});

	statemens.insert = ['INSERT OR IGNORE INTO ' + stmtTable + ' (' + stmtColumns + ') VALUES (' + stmtValues + ');', parameterValues];

	if (settings.settings.isDebug && settings.settings.isDebugMessageParsing) {
		console.log('jsontosqlparser: generateSQL: ' + sqlStatementToString(statemens.insert));
	}

	// geneate update sql statement

	stmtValues = '';
	stmtWhere = '';
	parameterValues = [];

	_.each(columns, function (c, i) {
		stmtValues += c.name + '=?';
		if (i < columns.length - 1) {
			stmtValues += ',';
		}
		parameterValues.push(c.value);
	});

	_.each(primaryKey, function (k, i) {
		stmtWhere += k + '=?';
		if (i < primaryKey.length - 1) {
			stmtWhere += ' AND ';
		}
		let kc = _.find(columns, function (c) {
			if (!_.isString(c.name)) {
				console.error('jsontosqlparser: generateSQL: column name is not string');
				throw new Error('sontosqlparser: generateSQL: column name is not string');
			}
			if (!_.isString(k)) {
				console.error('jsontosqlparser: generateSQL: primary key name is not string');
				throw new Error('sontosqlparser: generateSQL: primary key name is not string');
			}
			return c.name.toLowerCase() === k.toLowerCase();
		});
		if (kc) {
			parameterValues.push(kc.value);
		} else {
			console.error('jsontosqlparser: generateSQL: cannot find primary key: ' + k);
			throw new Error('sontosqlparser: generateSQL: cannot find primary key: ' + k);
		}
	});

	statemens.update = ['UPDATE ' + stmtTable + ' SET ' + stmtValues + ' WHERE ' + stmtWhere + ';', parameterValues];

	if (settings.settings.isDebug && settings.settings.isDebugMessageParsing) {
		console.log('jsontosqlparser: generateSQL: ' + sqlStatementToString(statemens.update));
	}

	return [statemens.insert, statemens.update];
}
