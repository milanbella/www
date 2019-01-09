import { promiseResolve, promiseReject } from '../common/utils';

import { database } from './database';
import { authPrincipal } from './authprincipal';
import { settings } from './settings';

import * as PrintModels from '../../app/print-models/print-models';

import { _ } from 'underscore';
import round10 from 'round10'

export class Business {

	organizations: any;

	constructor () {
	}

	async getReplicationStrategy() {
		var result = await database.execute('SELECT AD_ReplicationStrategy_ID_WS FROM device WHERE id=1');
		var AD_ReplicationStrategy_ID_WS;
		if(result.rows.length>0){
			return result.rows.item(0).AD_ReplicationStrategy_ID_WS;
		}
	}

	getSalesReps = (): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute('SELECT * FROM ad_user  WHERE ad_client_id=? AND isActive=\'Y\'', [principal.adClientId])
			.then((results) => {
				var salesReps = [];
				for(var i = 0; i < results.rows.length; i++)
				{
					salesReps.push(results.rows.item(i));
				}
				return salesReps;
			});
		});
	}

	getOrganizations = (): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute('SELECT * FROM ad_org  WHERE ad_client_id=? AND isSummary=\'N\'  AND isActive=\'Y\'', [principal.adClientId])
			.then((results) => {
				var organizations = [];
				for(var i = 0; i < results.rows.length; i++)
				{
					organizations.push(results.rows.item(i));
				}
				this.organizations = organizations;
				return organizations;
			});
		});
	}

	getWarehouses = (organizationId): Promise<any> => {
			var organization = _.find(this.organizations, (o)=> {
				return o.ad_org_id === organizationId;
			});
			if (!organization) {
				console.warn('no such organization (did you load organizations?)');
			}
			return database.execute('SELECT * FROM m_warehouse WHERE ad_org_id = ?', [organizationId]).then(function(results) {
				var warehouses = [];
				for(var i = 0; i < results.rows.length; i++)
				{
					warehouses.push(results.rows.item(i));
				}
				if (organization) {
					organization.___warehouses___ = warehouses;
				}
				return warehouses;
			});
	}

	getLocators = (organizationId, warehouseId): Promise<any> => {
			var warehouse;
			var organization = _.find(this.organizations, (o)=> {
				return o.ad_org_id === organizationId;
			});
			if (!organization) {
				console.warn('no such organization (did you load organizations?)');
			}
			else {
				warehouse = _.find(organization.___warehouses___, (w)=> {
					return w.m_warehouse_id === warehouseId;
				});
				if (!warehouse) {
					console.warn('no such warehouse (did you load warehaouses?)');
				}
			}
			
			return database.execute('SELECT m_locator_id, value FROM m_locator WHERE ad_org_id = ? AND m_warehouse_id = ?', [organizationId, warehouseId]).then(function(results) {
				var locators = [];
				for(var i = 0; i < results.rows.length; i++)
				{
					locators.push(results.rows.item(i));
				}
				if (warehouse) {
					warehouse.___locators___ = locators;
				}
				return locators;
			});
	}

	getAllLocators = (organizationId): Promise<any> => {
		var warehouse;
		var organization = _.find(this.organizations, (o)=> {
			return o.ad_org_id === organizationId;
		});
		if (!organization) {
			console.warn('no such organization (did you load organizations?)');
		}	
		
		return database.execute('SELECT * FROM m_locator WHERE ad_org_id = ? ', [organizationId]).then(function(results) {
			var locators = [];
			for(var i = 0; i < results.rows.length; i++)
			{
				locators.push(results.rows.item(i));
			}		
			return locators;
		});
	}

	getMoveMethods = (): Promise<any> => {
		return promiseResolve([
			{
				'name':'Item',
				'id':1
			},
			{
				'name':'Handling Unit',
				'id':2
			}
		]);
	}

	getOwnershipList = (): Promise<any> => {
		return promiseResolve([
			{
				'name':'Mine',
				'id':1
			},
			{
				'name':'Unasigned',
				'id':2
			},
			{
				'name':'Mine & Unasigned',
				'id':3
			},
			{
				'name':'All',
				'id':4
			}
		]);
	}
	//TODO Get DocTypes 2 parameter is for PhysInvCount
	getDocTypes = (docBaseType: string, docSubTypeInv?: string): Promise<any[]> => {
		return authPrincipal.getPrincipal().then((principal) => {
			if(docSubTypeInv) {
				return database.execute('SELECT * FROM c_doctype  WHERE ad_client_id=? AND docbasetype = ? AND docsubtypeinv <> ? AND isactive=?  ', [principal.adClientId, docBaseType, docSubTypeInv, 'Y'])
				.then((results) => {
					var docTypes = [];
					for(var i = 0; i < results.rows.length; i++)
					{
						docTypes.push(results.rows.item(i));
					}
					docTypes;
					return docTypes;
				});
			}
			return database.execute('SELECT * FROM c_doctype  WHERE ad_client_id=? AND docbasetype = ? AND isactive=? ', [principal.adClientId, docBaseType, 'Y'])
			.then((results) => {
				var docTypes = [];
				for(var i = 0; i < results.rows.length; i++)
				{
					docTypes.push(results.rows.item(i));
				}
				docTypes;
				return docTypes;
			});
		});
	}

	_getDisplayValue = (tableName, keyColumn, keyValue, displayColumn): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			if(this.hasTranslation(tableName)) {	// Checking if 
				return database.execute(`SELECT ${displayColumn} FROM ${tableName}_trl WHERE ${keyColumn}=? AND ad_language LIKE ?`, [keyValue, '%' + settings.settings.defaultLanguage + '%'])
				.then((result) => {
					if (result.rows.length > 0) {
						if (result.rows.item(0)[displayColumn]) {
							return result.rows.item(0)[displayColumn];
						} else {
							console.warn(`no display value for: ${tableName}, ${keyColumn}: ${keyValue}, ${displayColumn}`);
							return `?${keyValue}?`;
						}
					} else {
						// Try Original Table
						console.warn(`no display value for TRANSLATION: ${tableName}_trl, ${keyColumn}: ${keyValue}, ${displayColumn}`);
						console.log(`try regular Table`);
						return database.execute(`SELECT ${displayColumn} FROM ${tableName} WHERE ${keyColumn}=?`, [keyValue])
							.then((result) => {
								if (result.rows.length > 0) {
									if (result.rows.item(0)[displayColumn]) {
										return result.rows.item(0)[displayColumn];
									} else {
										console.warn(`no display value for: ${tableName}, ${keyColumn}: ${keyValue}, ${displayColumn}`);
										return `?${keyValue}?`;
									}
								} else {
									console.warn(`no display value for: ${tableName}, ${keyColumn}: ${keyValue}, ${displayColumn}`);
									return `?${keyValue}?`;
								}
							})
					}
				})
				.catch((err)=> {
					//Try Regular Table
					console.log(`try regular Table`);
					return database.execute(`SELECT ${displayColumn} FROM ${tableName} WHERE ${keyColumn}=?`, [keyValue])
					.then((result) => {
						if (result.rows.length > 0) {
							if (result.rows.item(0)[displayColumn]) {
								return result.rows.item(0)[displayColumn];
							} else {
								console.warn(`no display value for: ${tableName}, ${keyColumn}: ${keyValue}, ${displayColumn}`);
								return `?${keyValue}?`;
							}
						} else {
							console.warn(`no display value for: ${tableName}, ${keyColumn}: ${keyValue}, ${displayColumn}`);
							return `?${keyValue}?`;
						}
					})
				});
			}
			else {
				return database.execute(`SELECT ${displayColumn} FROM ${tableName} WHERE ${keyColumn}=?`, [keyValue])
				.then((result) => {
					if (result.rows.length > 0) {
						if (result.rows.item(0)[displayColumn]) {
							return result.rows.item(0)[displayColumn];
						} else {
							console.warn(`no display value for: ${tableName}, ${keyColumn}: ${keyValue}, ${displayColumn}`);
							return `?${keyValue}?`;
						}
					} else {
						console.warn(`no display value for: ${tableName}, ${keyColumn}: ${keyValue}, ${displayColumn}`);
						return `?${keyValue}?`;
					}
				})
			}			
		});
	}

	getDisplayValue = (appId, name, id): Promise<any> => {
		if (name === 'organization') {
			return this._getDisplayValue('ad_org', 'ad_org_id', id, 'name');
		} else if (name === 'product') {
			return this._getDisplayValue('m_product', 'm_product_id', id, 'name');
		} else if (name === 'product_sku') {
			return this._getDisplayValue('m_product', 'm_product_id', id, 'sku');
		} else if (name === 'product_ean') {
			return this._getDisplayValue('m_product', 'm_product_id', id, 'upc');
		} else if (name === 'product_value') {
			return this._getDisplayValue('m_product', 'm_product_id', id, 'value');
		} else if (name === 'lot_name') {
			return this._getDisplayValue('m_lot', 'name', id, 'M_Lot_ID');
		} else if (name === 'locator') {
			return this._getDisplayValue('m_locator', 'm_locator_id', id, 'value');
		} else if (name === 'attributesetinstance') {
			return this._getDisplayValue('m_attributesetinstance', 'm_attributesetinstance_id', id, 'lot');
		} else if (name === 'bpartner') {
			return this._getDisplayValue('c_bpartner', 'c_bpartner_id', id, 'name');
		} else {
			console.error(`display value not defined for: ${name}`);
			return promiseReject(`display value not defined for: ${name}`);
		}
	}

	_getValues = (tableName, keyColumn, conditionColumn, conditionValue): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute(`SELECT ${keyColumn}  FROM ${tableName} WHERE ${conditionColumn} LIKE ?`, ['%'+conditionValue+'%'])
			.then((result) => {
				if (result.rows.length > 0) {
					var value = '';
					if (result.rows.item(0)[keyColumn]) {
						value = result.rows.item(0)[keyColumn];
					} else {
						console.warn(`no key values for: ${tableName}, ${conditionColumn}: ${conditionValue}, ${keyColumn}`);
					}
					return value;
				} else {
					console.warn(`no values for: ${tableName}, ${conditionColumn}: ${conditionValue}`);
				}
			});
		});
	}

	_getExactValues = (tableName, keyColumn, conditionColumn, conditionValue): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute(`SELECT ${keyColumn}  FROM ${tableName} WHERE ${conditionColumn} = ?`, [conditionValue])
			.then((result) => {
				if (result.rows.length > 0) {
					var value = '';
					if (result.rows.item(0)[keyColumn]) {
						value = result.rows.item(0)[keyColumn];
					} else {
						console.warn(`no key values for: ${tableName}, ${conditionColumn}: ${conditionValue}, ${keyColumn}`);
					}
					return value;
				} else {
					console.warn(`no values for: ${tableName}, ${conditionColumn}: ${conditionValue}`);
				}
			});
		});
	}


	getExactValues = (params, conditionValue): Promise<any> => {
		return this._getExactValues(params.tableName, params.keyColumn, params.conditionColumn, conditionValue);
	}

	/**
	 * Check if tablename has translations
	 */
	hasTranslation = (tableName: string): boolean => {
		if(tableName.toLocaleLowerCase() == 'c_uom')
			return true;
		return false;
	}

	getValues = (params, conditionValue): Promise<any> => {
		return this._getValues(params.tableName, params.keyColumn, params.conditionColumn, conditionValue);
	}

	getM_Product_IDFromLot = (lot:	String): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute('SELECT M_Product_ID FROM M_Lot  WHERE ad_client_id=? AND Name=?  AND isActive=\'Y\'', [principal.adClientId, lot])
			.then((results) => {
				var v_M_Product_ID = 0;
				for(var i = 0; i < results.rows.length; i++)
				{
					v_M_Product_ID = (results.rows.item(i).m_product_id);
				}
				return v_M_Product_ID;
			});
		});
	}

	getQtyOnHand = (v_M_Product_ID:	number, v_M_AttributeSetInstance_ID:	number, v_M_Locator_ID: number): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute('SELECT QtyOnHand FROM M_StorageOnHand  WHERE ad_client_id=? AND M_Product_ID=?	AND M_AttributeSetInstance_ID=?	AND	M_Locator_ID=?  AND isActive=\'Y\'', [principal.adClientId, v_M_Product_ID,	v_M_AttributeSetInstance_ID,	v_M_Locator_ID])
			.then((results) => {
				var v_QtyOnHand = 0;
				for(var i = 0; i < results.rows.length; i++)
				{
					v_QtyOnHand = (results.rows.item(i).qtyonhand);
				}
				return v_QtyOnHand;
			});
		});
	}

	getM_Lot_ID = (v_lotName:	String): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute('SELECT M_Lot_ID FROM M_Lot  WHERE ad_client_id=? AND Name=?	AND isActive=\'Y\'', [principal.adClientId, v_lotName])
			.then((results) => {
				var v_M_Lot_ID = 0;
				for(var i = 0; i < results.rows.length; i++)
				{
					return (results.rows.item(i).m_lot_id);
				}
			});
		});
	}

	getM_AttributeSetInstance_ID = (v_M_Lot_ID:	number): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute('SELECT M_AttributeSetInstance_ID FROM M_AttributeSetInstance  WHERE ad_client_id=? AND M_Lot_ID=?	AND isActive=\'Y\'', [principal.adClientId, v_M_Lot_ID])
			.then((results) => {
				for(var i = 0; i < results.rows.length; i++)
				{
					return (results.rows.item(i).m_attributesetinstance_id);
				}
			});
		});
	}

	getInvoiceC_BPartner_Location_ID = (v_C_BPartner_ID:	number): Promise<any> => {
		return authPrincipal.getPrincipal().then((principal) => {
			return database.execute('SELECT C_BPartner_Location_ID FROM C_BPartner_Location  WHERE ad_client_id=? AND C_BPartner_ID=?	AND IsBillTo=\'Y\'	AND isActive=\'Y\'', [principal.adClientId, v_C_BPartner_ID])
			.then((results) => {
				for(var i = 0; i < results.rows.length; i++)
				{
					return (results.rows.item(i).c_bpartner_location_id);
				}
			});
		});
	}

	getDefaultWarehouseLocator_ID = (warehouseId): Promise<any> => {
			return database.execute('SELECT * FROM m_locator WHERE m_warehouse_id = ? AND m_locator.isdefault = ? LIMIT 1', [warehouseId, 'Y']).then(function(results) {
				var locator = [];
				for(var i = 0; i < results.rows.length; i++)
				{
					return results.rows.item(i).m_locator_id;
				}
				return 0;
			});
	}

	calcQtyOrdered = (m_product_id: number, c_uom_id: number, c_uom_to_id: number, qtyEntered: number): Promise<any> => {
		if(c_uom_id === c_uom_to_id) {
			return new Promise((resolve) => {resolve(qtyEntered)});
		}
		return database.execute('SELECT * FROM c_uom_conversion WHERE m_product_id = ? AND c_uom_id = ? AND c_uom_to_id = ? ', [m_product_id, c_uom_id, c_uom_to_id])
		.then((results) => {
			for(var i = 0; i < results.rows.length; i++)
			{
				return round10.round10(qtyEntered*results.rows.item(i).dividerate,-2);
			}
			return qtyEntered;
		});
	}

	//getIsDisallowedPOSBPartner
	getIsDisallowedPOSBPartner = (c_doctype_id: number): Promise<boolean> => {
		return authPrincipal.getPrincipal().then((principal) => {
			if(c_doctype_id) {
				return database.execute('SELECT isdisallowposbpartner FROM c_doctype  WHERE ad_client_id=? AND c_doctype_id = ? ', [principal.adClientId, c_doctype_id])
				.then((results) => {
					var isDisallowedPOSBPartner = false;
					for(var i = 0; i < results.rows.length; i++)
					{
						isDisallowedPOSBPartner = results.rows.item(i).isdisallowposbpartner == 'Y';
						
					}					
					return isDisallowedPOSBPartner;
				});
			}
			return false;			
		});
	}	//getIsDisallowedPOSBPartner

	getWasteRecyclingFee = (m_product_id: number): Promise<any> => {
		return database.execute('SELECT * FROM M_Product_PO WHERE m_product_id = ? ORDER BY IsCurrentVendor DESC', [m_product_id])
		.then((results) => {
			for(var i = 0; i < results.rows.length; i++)
			{
				return results.rows.item(i).wasterecyclingfee
				;
			}
			return 0;
		});
	}	//	getWasteRecyclingFee


	getBPartnerPrintInfo = (c_bpartner_id: number): Promise<PrintModels.BPartner> => {
		return database.execute('SELECT name, value, taxid, taxid_alternative, compregno  FROM C_BPartner WHERE c_bpartner_id = ?', [c_bpartner_id])
		.then((results) => {
			for(var i = 0; i < results.rows.length; i++)
			{
				let p_BPartner:PrintModels.BPartner = {
					Name: results.rows.item(i).name,
					Value: results.rows.item(i).value,
					TaxID: results.rows.item(i).taxid,
					CompRegNo: results.rows.item(i).compregno,
					TaxID_Alternative: results.rows.item(i).taxid_alternative
				};
				return p_BPartner;
			}
			return null;
		});
	}	//	getBPartnerPrintInfo
	

	getBPartnerAddressPrintInfo = (c_bpartner_location_id: number): Promise<PrintModels.Address> => {
		return database.execute('SELECT loc.address1, loc.city, loc.postal FROM C_BPartner_Location bploc JOIN C_Location loc ON (loc.C_Location_ID = bploc.C_Location_ID ) WHERE bploc.c_bpartner_location_id = ?', [c_bpartner_location_id])
		.then((results) => {
			for(var i = 0; i < results.rows.length; i++)
			{
				let p_BPartner:PrintModels.Address = {
					Address: results.rows.item(i).address1,
					City: results.rows.item(i).city,
					ZIP: results.rows.item(i).postal					
				};
				return p_BPartner;
			}
			return null;
		});
	}	//	getBPartnerAddressPrintInfo

	getProductPrintInfo = (m_product_id: number): Promise<any> => {
		return database.execute('SELECT p.name, p.value, p.upc, p.sku FROM M_Product p WHERE p.m_product_id = ?', [m_product_id])
		.then((results) => {
			for(var i = 0; i < results.rows.length; i++)
			{
				let p_Product = {
					Name: results.rows.item(i).name,
					Value: results.rows.item(i).value,
					UPC: results.rows.item(i).upc,
					SKU: results.rows.item(i).sku						
				};
				return p_Product;
			}
			return null;
		});
	}	//	getProductPrintInfo

	getQtyRange(): any {
		return [
				{
					name: "Not 0", 
					value: "N"
				},
				{
					name: "< 0", 
					value: "<"
				},
				{
					name: "> 0", 
					value: ">"
				},
				{
					name: "= 0", 
					value: "="
				},
				{
					name: "", 
					value: ""
				}
			];
	}	
}

export var business: Business = new Business();
