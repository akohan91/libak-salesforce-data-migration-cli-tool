export type TreeConfig = {
	apiName: string,
	externalIdField?: string,
	recordIds?: string[],
	parentRecordIds?: string[],
	referenceField?: string,
	excludedFields?: string[],
	requiredReferences?: string[],
	children?: TreeConfig[]
}

export type DatabaseUnifiedResult = {
	successCount: number,
	successIds: (string | undefined)[],
	errorCount: number,
	errors?: DatabaseUnifiedError[]
}

export type DatabaseUnifiedError = {
	statusCode: string,
	message: string,
	fields: string[]
}