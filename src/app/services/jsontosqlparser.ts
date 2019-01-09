import { Injectable } from '@angular/core';
import { settings } from './settings';
import { clone } from './../common/utils';
import { parseSQSmessageToSQL } from './jsontosqlparser1';


import { _ } from 'underscore';

function pad2(n) {
	return (n < 10 ? '0' : '') + n;
}

@Injectable()
export class JsonToSQLParser {
	public parseSQL: any;
	public getRecords: any;
	public generateSQLstatemens: any;
	public sqlStatementToString: any;

	constructor () {
		var parse = function(data?, queries?, root?) {
			if(typeof data !== 'object')
				return queries;

			if(typeof root === 'boolean' && root)
				data.DataType = 'list';

			if(typeof data['DataType'] === 'string')
			{
				switch(data['DataType'].toLowerCase())
				{
				case 'record':
					var tableInfo = {
						columns: {},
						table: '',
						primarykey: '',
						tablevel: 0,
						queriesAfter: []
					};

	/* eslint-disable */ //TODO: Rewrite parser correctly. If we put terminating 'break' statement here  then parser breaks because variable 'tableInfo' is not initialized to empty object by the code above (becomes undefined instead).
				case 'list':
	/* eslint-enable */
					if(typeof tableInfo !== 'undefined' && typeof data['TabLevel'] !== 'undefined')
					{
						tableInfo['tablevel'] = data['TabLevel'];
					}

					for(var k in data)
					{
						// skip metadata which are not regular table columns
						if(k === 'DataType' ||
							k === 'ReplicationType' ||
							k === 'WebContext' ||
							k === 'Version' ||
							k === 'AD_Client_Value' ||
							k === 'ReplicationEvent' ||
							k === 'TabLevel' ||
							k === 'ReplicationMode' ||
							k === 'TargetType' ||
							k === 'PrimaryKey')
							continue;

						if(typeof tableInfo !== 'undefined' && k === 'AD_Table')
						{
							tableInfo['table'] = data[k];
							continue;
						}else if(typeof tableInfo !== 'undefined' && k === 'AD_Column_ID')
						{
							tableInfo['primarykey'] = data[k];
							continue;
						}

						var child = data[k];
						switch(typeof child)
						{
						case 'object':
							if(child.constructor === Array && !root)
							{
								for(var ck in child)
								{

									var isNotDependency = (typeof child[ck] === 'object' && child[ck].TabLevel > tableInfo['tablevel']);
									parse({
										virtualList: child[ck]
									}, isNotDependency ? tableInfo.queriesAfter : queries, isNotDependency);
								}
							} else {
								if(child.constructor === Array) {
									for(let index in child)
									{
										child = child[index];
										break;
									}
								}

								var val = parse(child, queries);
								if(!root && typeof child.AD_Column_ID === 'string')
								{
									if(typeof child[child.AD_Column_ID] !== 'undefined')
									{
										tableInfo['columns'][k] = child[child.AD_Column_ID];
									}
								}

								if(typeof val !== 'undefined')
								{
									tableInfo['columns'][k] = val;
								}
							}
							break;

						case 'boolean':
							tableInfo['columns'][k] = child ? 'Y' : 'N';
							break;

						default:
							if(typeof child === 'string')
								child = child.replace('\'', '\'\'');

							tableInfo['columns'][k] = child;
						}
					}
					break;

				case 'date': // future
					var d = new Date(data.content);

					return d.getFullYear() + '-' +
						pad2(d.getMonth() + 1) + '-' +
						pad2(d.getDate()) + ' ' +
						pad2(d.getHours()) + ':' +
						pad2(d.getMinutes()) + ':' +
						pad2(d.getSeconds());

				default:
				}

				if(typeof tableInfo === 'object')
				{
					var prepareSqlValues = [];
					var sqlColumns = '';
					var sqlValuesUpdate = '';
					var sqlValuesInsert = '';

					var columnCount = 0;
					for(var c in tableInfo.columns)
					{
						columnCount++;
						sqlColumns += (sqlColumns.length !== 0 ? ',' : '') + '\'' + c + '\'';
						sqlValuesUpdate += (sqlValuesUpdate.length !== 0 ? ', ' : '') + '\`' + c + '\`' + '=?';
						sqlValuesInsert += (sqlValuesInsert.length !== 0 ? ',' : '') + '?';
						prepareSqlValues.push(tableInfo.columns[c]);
					}

					prepareSqlValues.push(tableInfo.columns[tableInfo.primarykey]);

					if(!(columnCount === 1 && tableInfo.columns[tableInfo.primarykey] !== 'undefined'))
					{
						//queries.push('UPDATE "' + tableInfo.table.toLowerCase() + '" SET ' + sqlValuesUpdate + ' WHERE ' + "`" + tableInfo.primarykey + "`" + "=" + "'" + tableInfo.columns[tableInfo.primarykey] + "'" + ';');
						queries.push(
							[
								'INSERT OR IGNORE INTO "' + tableInfo.table.toLowerCase() + '" (' + sqlColumns + ') VALUES (' + sqlValuesInsert + ');',
								prepareSqlValues.slice(0, prepareSqlValues.length-1)
							]
						);
						queries.push(
							[
								'UPDATE "' + tableInfo.table.toLowerCase() + '" SET ' + sqlValuesUpdate + ' WHERE ' + '\`' + tableInfo.primarykey + '\`' + '=' + '?' + ';',
								prepareSqlValues.slice(0)
							]
						);


						if(tableInfo.queriesAfter.length > 0)
							for(var qAi in tableInfo.queriesAfter)
								queries.push(tableInfo.queriesAfter[qAi]);
					}
				}
			}
		};


		this.parseSQL = (source) => {
			if (settings.settings.isDebug && settings.settings.isDebugSQSparsing) {
				console.debug('jsontosqlparser: parseSQL: source:');
				console.dir(source);
			}
			var queries = [];
			parse(source, queries, true);
			if (settings.settings.isDebug && settings.settings.isDebugSQSparsing) {
				console.debug('jsontosqlparser: parseSQL: queries:');
				console.dir(queries);
			}
			// return queries;
			var sqls = parseSQSmessageToSQL(source);
			return sqls;
		};

	}
}

