export interface AsyncJob {
	AD_PInstance_ID: number;
	ErrorMsg: string;
	IsProcessing: boolean;
}

export type AsyncJobStatus = 'new' | 'posted' | 'processed' | 'error';
