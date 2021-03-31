import { cdDbObject } from '../types';

export interface M_WorksheetLine extends cdDbObject {
	M_InOutLineConfirm_ID?: number;

	Line: number;

	TargetQty: number;

	ScrappedQty: number;

	ConfirmedQty: number;

	DifferenceQty: number;

	M_Product_ID: number;

	M_Locator_ID: number;

	ConfirmationNo?: string;

	Description?: string;

	M_WorksheetLine_UU?: string; //M_InOutLineConfirm_UU
}
