'use strict';

export interface PhysCountsPOSTRequestMInventoryLine {
	M_InventoryLine_UU?: string;

	M_Product_ID?: number;

	M_Locator_ID?: number;

	Line?: number;

	QtyCount?: number;

	QtyBook?: number;

	Description?: string;
}
