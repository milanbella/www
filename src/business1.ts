import { PROJECT_NAME } from './consts';
import { Principal } from './types';
import { settings } from './settings';
import { persist } from './persist';
import { persistCache } from './persistCache';
import { authPrincipal } from './authprincipal';
import { EnumList } from './common/utils';
import { Logger } from './types';
import { getLogger } from './logger';
import { DocumentProcessingStatus, Ownership } from './types';

import { BPartner } from './print-model/print-models';
import { Address } from './print-model/print-models';

import round10 from 'round10';
import * as _ from 'underscore';

let logger = getLogger(PROJECT_NAME, 'business1.ts');

export interface PosTerminal {
	id: number;
	name: string;
	description: string;
}

export class Business {
	constructor() {}

	async getReplicationStrategy() {
		let record = await persist.getRecord('device', [1]);
		return record;
	}

	async getSalesReps() {
		let principal: Principal = await authPrincipal.getPrincipal();
		let records = await persist.getIndexRecords('ad_user', 'ad_client_id', [Number(principal.adClientId)]);
		records = _.where(records, (r) => {
			return r.isactive === 'Y';
		});
		return records;
	}

	async getOrganizations() {
		let principal: Principal = await authPrincipal.getPrincipal();
		let records = await persist.getIndexRecords('ad_org', 'ad_client_id', [Number(principal.adClientId)]);
		records = _.where(records, (r) => {
			return r.isactive === 'Y'; //FIXME Disabled Not Replicated && r.issummary === 'N'
		});
		return records;
	}

	async getWarehouses(ad_org_id) {
		let records = await persist.getIndexRecords('m_warehouse', 'ad_org_id', [ad_org_id]);
		return records;
	}

	async getLocators(organizationId, warehouseId) {
		let records = await persist.getIndexRecords('m_locator', 'ad_org_id_m_warehouse_id', [organizationId, warehouseId]);
		return records;
	}

	async getLocatorsForOrganization(organizationId) {
		let records = await persist.getIndexRecords('m_locator', 'ad_org_id', [organizationId]);
		return records;
	}

	getMoveMethods = (): Promise<any> => {
		return Promise.resolve([
			{
				name: 'Item',
				id: 1,
			},
			{
				name: 'Handling Unit',
				id: 2,
			},
		]);
	};

	getOwnershipList = (): Promise<any> => {
		return Promise.resolve([
			{
				name: 'Mine',
				id: 1,
			},
			{
				name: 'Unasigned',
				id: 2,
			},
			{
				name: 'Mine & Unasigned',
				id: 3,
			},
			{
				name: 'All',
				id: 4,
			},
		]);
	};

	async getDocTypes(docBaseType: string, docSubTypeInv?: string) {
		let principal: Principal = await authPrincipal.getPrincipal();
		let records;
		if (docSubTypeInv) {
			records = await persist.getIndexRecords('c_doctype', 'ad_client_id_docbasetype_docsubtypeinv', [Number(principal.adClientId), docBaseType, docSubTypeInv]);
			records = _.where(records, (r) => {
				r.isactive = 'Y';
			});
			return records;
		} else {
			records = await persist.getIndexRecords('c_doctype', 'ad_client_id_docbasetype', [Number(principal.adClientId), docBaseType]);
			records = _.where(records, (r) => {
				r.isactive = 'Y';
			});
			return records;
		}
	}

	getLocaleId(): string {
		const FUNC = 'getLocaleId()';
		let lang = settings.settings.defaultLanguage;
		if (lang === 'en') {
			return 'en_US';
		} else if (lang === 'sk') {
			return 'sk_SK';
		} else if (lang === 'cz') {
			return 'cs_CZ';
		} else if (lang === 'hu') {
			return 'hu_HU';
		} else {
			let errs = `unsupported language: ${lang}`;
			let err = new Error(errs);
			logger.error(FUNC, errs, err);
			throw err;
		}
	}

	async getKeyDisplayValue(tableName: string, keyColumnName: string, keyValue: string | number, displayColumnName: string) {
		const FUNC = 'getKeyDisplayValue()';
		if (keyValue === undefined || keyValue === null) {
			return;
		}

		tableName = tableName.toLowerCase();
		keyColumnName = keyColumnName.toLowerCase();
		displayColumnName = displayColumnName.toLowerCase();

		let db = await persist.getDb();
		let keyNames, keyValues;

		if (await persist.tableExists(`${tableName}_trl`, db)) {
			tableName = `${tableName}_trl`;
			keyNames = [keyColumnName, 'ad_language'];
			keyValues = [keyValue, this.getLocaleId()];
		} else {
			keyNames = [keyColumnName];
			keyValues = [keyValue];
		}

		let indexName;

		if (!(await persist.primaryKeyExists(tableName, keyNames, db))) {
			indexName = await persist.findIndexName(tableName, keyNames, db);
			if (!indexName) {
				let key = keyNames.reduce((a, s, i) => {
					if (i < keyNames.length - 1) {
						a += s + ',';
					}
					return a;
				}, '');
				key = '[' + key + ']';
				let errs = `getKeyDisplayValue(): no primary key or index defined for table '${tableName}', key '${key}'`;
				let err = new Error(errs);
				logger.error(FUNC, errs, err);
				throw err;
			}
		}

		let record;
		if (indexName) {
			record = await persist.getIndexRecord(tableName, indexName, keyValues, db);
		} else {
			record = await persistCache.getRecord(tableName, keyValues, db);
		}

		if (record) {
			return record[displayColumnName];
		} else {
			if (false) {
				console.warn(`getKeyDisplayValue(): no display value: tableName: ${tableName}, keyColumnName: ${keyColumnName}, keyValue: ${keyValue}, displayColumnName: ${displayColumnName}`);
			}
		}
	}

	/**
	 * Get Key Value by pradicate Column
	 * @param tableName
	 * @param predicateColumnName
	 * @param predicateValue
	 * @param keyColumnName
	 * @return key Column Value
	 */
	async getKeyValueByColumn(tableName: string, predicateColumnName: string, predicateValue: string | number, keyColumnName: string) {
		const FUNC = 'getKeyValueByColumn()';
		if (predicateValue === undefined || predicateValue === null) {
			return;
		}

		tableName = tableName.toLowerCase();
		predicateColumnName = predicateColumnName.toLowerCase();
		keyColumnName = keyColumnName.toLowerCase();

		let db = await persist.getDb();

		let indexName;

		if (!(await persist.primaryKeyExists(tableName, [predicateColumnName], db))) {
			indexName = await persist.findIndexName(tableName, [predicateColumnName], db);
			if (!indexName) {
				let errs = `getKeyDisplayValue(): no primary key or index defined for table '${tableName}', key '${predicateColumnName}'`;
				let err = new Error(errs);
				logger.error(FUNC, errs, err);
				throw err;
			}
		}

		let record;
		if (indexName) {
			record = await persist.getIndexRecord(tableName, indexName, [predicateValue], db);
		} else {
			record = await persist.getRecord(tableName, [predicateValue], db);
		}

		if (record) {
			return record[keyColumnName];
		}
	}

	async getKeyValueByColumnRegex(tableName: string, predicateColumnName: string, regexValue: string | RegExp, keyColumnName: string) {
		tableName = tableName.toLowerCase();
		predicateColumnName = predicateColumnName.toLowerCase();
		keyColumnName = keyColumnName.toLowerCase();

		let regex;
		if (_.isString(regexValue)) {
			regex = new RegExp(regexValue);
		} else {
			regex = regexValue;
		}

		let records = await persist.getRecords(tableName);
		let record = records.find((r) => {
			if (_.isString(r[predicateColumnName])) {
				return null !== r[predicateColumnName].match(regex);
			}
		});

		if (record) {
			return record[keyColumnName];
		}
	}

	getDisplayValue = (_appId, name, id): Promise<any> => {
		if (name === 'organization') {
			return this.getKeyDisplayValue('ad_org', 'ad_org_id', id, 'name');
		} else if (name === 'product') {
			return this.getKeyDisplayValue('m_product', 'm_product_id', id, 'name');
		} else if (name === 'product_sku') {
			return this.getKeyDisplayValue('m_product', 'm_product_id', id, 'sku');
		} else if (name === 'product_ean') {
			return this.getKeyDisplayValue('m_product', 'm_product_id', id, 'upc');
		} else if (name === 'product_value') {
			return this.getKeyDisplayValue('m_product', 'm_product_id', id, 'value');
		} else if (name === 'lot_name') {
			return this.getKeyDisplayValue('m_lot', 'name', id, 'M_Lot_ID');
		} else if (name === 'locator') {
			return this.getKeyDisplayValue('m_locator', 'm_locator_id', id, 'value');
		} else if (name === 'attributesetinstance') {
			return this.getKeyDisplayValue('m_attributesetinstance', 'm_attributesetinstance_id', id, 'lot');
		} else if (name === 'bpartner') {
			return this.getKeyDisplayValue('c_bpartner', 'c_bpartner_id', id, 'name');
		} else {
			console.error(`display value not defined for: ${name}`);
			return Promise.reject(`display value not defined for: ${name}`);
		}
	};

	hasTranslation = (tableName: string): boolean => {
		if (tableName.toLocaleLowerCase() === 'c_uom') {
			return true;
		} else {
			return false;
		}
	};

	async getM_Product_IDFromLot(lot: string) {
		let principal: Principal = await authPrincipal.getPrincipal();
		let records = await persist.getIndexRecords('m_lot', 'ad_client_id_name', [principal.adClientId, lot]);
		records = _.where(records, (r) => {
			return r.isActive === 'Y';
		});
		if (records.length > 0) {
			return records[0].m_product_id;
		}
	}

	async getQtyOnHand(v_M_Product_ID: number, v_M_AttributeSetInstance_ID: number, v_M_Locator_ID: number) {
		let records = await persist.getIndexRecords('m_storageonhand', 'm_product_id_m_locator_id', [v_M_Product_ID, v_M_Locator_ID]);
		records = _.where(records, (r) => {
			return r.m_attributesetinstance_id === v_M_AttributeSetInstance_ID && r.isactive === 'Y';
		});
		if (records.length > 0) {
			return records[0].qtyonhand;
		} else {
			return 0;
		}
	}

	async getM_Lot_ID(v_lotName: string) {
		let records = await persist.getIndexRecords('m_lot', 'name', [v_lotName]);
		records = _.where(records, (r) => {
			return r.isactive === 'Y';
		});
		if (records.length > 0) {
			return records[0].m_lot_id;
		}
	}

	async getM_AttributeSetInstance_ID(v_M_Lot_ID: number) {
		let records = await persist.getIndexRecords('m_attributesetinstance', 'm_lot_id', [v_M_Lot_ID]);
		records = _.where(records, (r) => {
			return r.isactive === 'Y';
		});
		if (records.length > 0) {
			return records[0].m_attributesetinstance_id;
		}
	}

	async getInvoiceC_BPartner_Location_ID(v_C_BPartner_ID: number) {
		let records = await persist.getIndexRecords('c_bpartner_location', 'c_bpartner_id', [v_C_BPartner_ID]);
		records = _.where(records, (r) => {
			return r.isbillto === 'Y' && r.isactive === 'Y';
		});
		if (records.length > 0) {
			return records[0].c_bpartner_location_id;
		}
	}

	async getDefaultWarehouseLocator_ID(warehouseId) {
		let record = await persist.getIndexRecord('m_locator', 'm_warehouse_id_isdefault', [warehouseId, 'Y']);
		if (record) {
			return record.m_locator_id;
		} else {
			return 0;
		}
	}

	async calcQtyOrdered(m_product_id: number, c_uom_id: number, c_uom_to_id: number, qtyEntered: number) {
		if (c_uom_id === c_uom_to_id) {
			return qtyEntered;
		}
		let records = await persist.getIndexRecords('c_uom_conversion', 'm_product_id_c_uom_id_c_uom_to_id', [m_product_id, c_uom_id, c_uom_to_id]);
		if (records.length > 0) {
			return round10(qtyEntered * records[0].dividerate, -2);
		}
	}

	async getIsDisallowedPOSBPartner(c_doctype_id: number) {
		let record = await persist.getRecord('c_doctype', [c_doctype_id]);
		if (record) {
			return record.isdisallowposbpartner === 'Y';
		} else {
			return false;
		}
	}

	async getWasteRecyclingFee(m_product_id: number) {
		let records = await persist.getRecords('m_product_po', [m_product_id]);
		records = _.sortBy(records, (r: any) => {
			return -1 * r.iscurrentvendor;
		}).reverse();
		if (records.length > 0) {
			return records[0].wasterecyclingfee;
		} else {
			return 0;
		}
	}

	async getBPartnerPrintInfo(c_bpartner_id: number) {
		let record = await persist.getRecord('c_bpartner', [c_bpartner_id]);
		if (record) {
			let p_BPartner: BPartner = {
				Name: record.name,
				Value: record.value,
				TaxID: record.taxid,
				CompRegNo: record.compregno,
				TaxID_Alternative: record.taxid_alternative,
			};
			return p_BPartner;
		} else {
			return null;
		}
	}

	async getBPartnerAddressPrintInfo(c_bpartner_location_id: number): Promise<Address> {
		let rBpartner = await persist.getRecord('c_bpartner_location', [c_bpartner_location_id]);
		if (rBpartner) {
			let rLocation = await persist.getRecord('c_location', [rBpartner.c_location_id]);
			if (rLocation) {
				let p_BPartner: Address = {
					Address: rLocation.address1,
					City: rLocation.city,
					ZIP: rLocation.postal,
				};
				return p_BPartner;
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	async getProductPrintInfo(m_product_id: number) {
		let record = await persist.getRecord('m_product', [m_product_id]);
		if (record) {
			let p_Product = {
				Name: record.name,
				Value: record.value,
				UPC: record.upc,
				SKU: record.sku,
			};
			return p_Product;
		} else {
			return null;
		}
	}

	getQtyRange(): any {
		return [
			{
				name: 'Not 0',
				value: 'N',
			},
			{
				name: '< 0',
				value: '<',
			},
			{
				name: '> 0',
				value: '>',
			},
			{
				name: '= 0',
				value: '=',
			},
			{
				name: '',
				value: '',
			},
		];
	}

	getProcessingStatusEnum(): EnumList<DocumentProcessingStatus> {
		return ['new', 'processed', 'posted', 'error'];
	}

	getOwnershipEnum(): EnumList<Ownership> {
		return ['Mine', 'Others', 'Unassigned'];
	}

	async getPosTerminals(): Promise<PosTerminal[]> {
		let records = await persist.getRecords('c_pos');
		let ids = records
			.map((r) => {
				return {
					id: r.c_pos_id,
					name: r.name,
					description: r.description,
				};
			})
			.sort((r1, r2) => {
				return r1.name.localeCompare(r2.name);
			});
		return ids;
	}
}

export let business: Business = new Business();
