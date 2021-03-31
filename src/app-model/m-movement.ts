import { cdDocument, DocumentProcessingStatus } from '../types';
import { M_MovementLine } from './m-movement-line';

export interface M_Movement extends cdDocument {
	M_Movement_UU: string;
	DB_TableName: string;
	DB_Processed: boolean;
	M_Movement_ID: number;
	DocStatus: string;
	Created: Date;
	MovementDate: Date;
	AD_Org_ID: number;
	SalesRep_ID: number;
	C_DocType_ID: number;
	Description?: string;
	M_MovementLine: Array<M_MovementLine>;
	M_Locator_ID?: number;
	M_LocatorTo_ID?: number;
	Source?: string;
	DocumentNo?: string;
	C_BPartner_ID?: number;
	DocAction: string;
	IsConfirmationReq: boolean;
	POReference?: string;
	C_BPartner_Location_ID?: number;
	documentProcessingStatus: DocumentProcessingStatus;
}
