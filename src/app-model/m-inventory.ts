import { M_InventoryLine } from './m-inventory-line';
import { cdDocument } from '../types';
import { v1 as uuidV1 } from 'uuid';

export interface M_Inventory extends cdDocument {
	M_Inventory_UU: string;
	DB_TableName: string;
	DB_Processed: boolean;
	C_Inventory_ID: number;
	IsConfirmationReq: boolean;
	DocStatus: string;
	DocAction: string;
	Created: Date;
	MovementDate: Date;
	AD_Org_ID: number;
	M_Warehouse_ID: number;
	SalesRep_ID: number;
	C_DocType_ID: number;
	Description?: string;
	M_InventoryLine: M_InventoryLine[];
	C_BPartner_ID?: number;
	C_BPartner_Location_ID?: number;
}

export class MInventory {
	static newInventory(): M_Inventory {
		return {
			modifiedDate: new Date().toISOString(),
			M_Inventory_UU: uuidV1(),
			DB_TableName: 'M_Inventory',
			DB_Processed: false,
			C_Inventory_ID: 0,
			DocStatus: 'DR',
			DocAction: 'PR',
			IsConfirmationReq: false,
			Created: new Date(),
			MovementDate: new Date(),
			AD_Org_ID: 0,
			M_Warehouse_ID: 0,
			SalesRep_ID: 0,
			C_DocType_ID: 0,
			Description: null,
			M_InventoryLine: [],
			AD_PInstance_ID: 0,
			documentProcessingStatus: 'new',
		};
	}
}
