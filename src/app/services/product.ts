import { Injectable } from '@angular/core';

@Injectable()
export class Product {
	public list: any;
	public get: any;

	constructor() {

		var products =
			[

				{
					'Value' : 'SHS222-KJ123',
					'Name' : 'Notebook Lenove A22',
					'QtyOnHand' : '2',
					'finished': false,
					'm_product_id': 1,
				},
				{
					'Value' : 'P9L',
					'Name' : 'HUAWEI MOBILE P9 Light',
					'QtyOnHand' : '10',
					'finished': false,
					'm_product_id': 2,

				}
			];

		this.list = function(){
			return products;
		};

		this.get = function(id){
			for(var i=0; i<products.length; i++){
				if(products[i].m_product_id === id){
					return products[i];
				}
			}
			return undefined;
		};
	}
}
