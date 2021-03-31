import { cdDbObject } from '../types';
import { v1 as uuidV1 } from 'uuid';

export interface M_InventoryLine extends cdDbObject {
	M_InventoryLine_UU: string;
	M_Product_ID: number;
	M_Locator_ID: number;
	Line: number;
	QtyCount: number;
	QtyBook?: number;
	isConfirmedQty?: boolean;
	QtyBookUpdated?: Date;
	C_UOM_ID: number;
	Description?: string;
}

export class MInventoryLine {
	// TODO use Constructor Logic

	static newInventoryLine(): M_InventoryLine {
		return {
			M_InventoryLine_UU: uuidV1(),
			M_Product_ID: 0,
			M_Locator_ID: 0,
			C_UOM_ID: 0,
			Line: 0,
			QtyCount: 0,
			Description: null,
		};
	}
}
