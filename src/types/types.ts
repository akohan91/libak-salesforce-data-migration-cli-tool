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

export type ReferenceIdMapping = {
	sObjectType: string,
	masterField: string,
	conditionField: string,
	conditionValues: any[]
}

export type DatabaseUnifiedResult = {
	successCount: number,
	successIds: Set<string>,
	errorCount: number,
	errors?: DatabaseUnifiedError[]
}

export type DatabaseUnifiedError = {
	statusCode: string,
	message: string,
	fields: string[]
}

export enum SObjectName {
	RecordType = 'RecordType'
}

export enum FieldType {
	id = 'id',
	reference = 'reference'
}

export enum FieldName {
	Id = 'Id',
	DeveloperName = 'DeveloperName',
	SobjectType = 'SobjectType'
}

export enum SobjectType {
	RecordType = 'RecordType',
}

export enum DML {
	insert = 'insert',
	upsert = 'upsert',
	update = 'update',
	delete = 'delete',
}

export enum CliArgName {
	sourceOrg = 'sourceOrg',
	targetOrg = 'targetOrg',
	exportConfig = 'exportConfig',
	analyzeReferences = 'analyzeReferences',
}

export enum HTTP {
	GET = 'GET'
}