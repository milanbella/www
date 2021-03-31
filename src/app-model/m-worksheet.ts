import { cdDocument } from '../types';
import { M_WorksheetLine } from './m-worksheet-line';

export interface M_Worksheet extends cdDocument {
	M_Worksheet_UU: string; // M_InOutConfirm_UU

	DB_TableName: string;

	M_InOutConfirm_ID: number;

	DocumentNo: string;

	C_Invoice_DocumentNo?: string;

	C_Order_DocumentNo?: string;

	C_DocType_ID: number;

	DocStatus: string;

	DocAction: string;

	Created: Date;

	AD_Org_ID: number;

	SalesRep_ID: number;

	Description?: string;

	M_WorksheetLine: Array<M_WorksheetLine>;

	IsApproved: boolean;

	IsCancelled: boolean;

	IsInDispute: boolean;

	C_BPartner_ID: number;

	ConfirmationReference?: string;

	ConfirmationNo?: string;
}
