import { Injectable } from '@angular/core';

@Injectable()
export class Focus {
	public focus: any;

	constructor () {
		this.focus = function (id) {
			var element = window.document.getElementById(id);
			if(element) {
				element.focus();
			}
		};
	}
}
