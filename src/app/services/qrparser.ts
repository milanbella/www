import { Injectable } from '@angular/core';

@Injectable()
export class QRParser {
	public parse: any;

	constructor () {
		this.parse = function(source)
		{
			var params = source.barcode.match(/CLDE\:|([A-Z]+)\:([^;:]*)/g);
			if(typeof params[0] !== 'string' || params[0] !== 'CLDE:')
				return source;

			params.splice(0, 1);

			var result = {};

			for(var i in params)
			{
				var scIndex = params[i].indexOf(':');
				result[
					params[i].substring(0, scIndex)
				] = params[i].substring(++scIndex);
			}

			return result;
		};
	}
}
