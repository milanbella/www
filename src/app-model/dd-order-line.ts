import { cdDbObject } from '../types';

export interface DD_OrderLine extends cdDbObject {
	DD_OrderLine_ID?: number;
	DD_OrderLine_UU?: number;
	Lot: string;
	M_Product_ID: number;
	M_Locator_ID: number;
	M_LocatorTo_ID: number;
	Line: number;
	Qty: number;
	ConfirmedQty: number;
	ScrappedQty: number;
	QtyOrdered: number;
	Description?: string;
	WMSNote?: string;
}
