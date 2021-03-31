import { cdDbObject } from '../types';

export interface M_MovementLine extends cdDbObject {
	M_Product_ID: number;
	M_Locator_ID: number;
	M_LocatorTo_ID: number;
	Line: number;
	MovementQty: number;
	C_UOM_ID: number;
	Description?: string;
	IsConfirmedQty?: boolean;
	M_MovementLine_ID?: number;
	M_MovementLine_UU?: string;
	M_AttributeSetInstance_ID: number;
	ConfirmedNo: number;
}
