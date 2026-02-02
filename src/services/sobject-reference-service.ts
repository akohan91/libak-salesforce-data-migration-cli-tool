import { getSourceDb, getTargetDb } from "./database.ts";
import { FieldName, ReferenceIdMapping, SobjectType, type TreeConfig } from "../types/types.ts";
import { SoqlBuilder } from "./soql-builder.ts";
import type { Field, SaveResult } from "jsforce";

export class SobjectReferenceService {
	_referenceFields: string[];
	_sourceRecordIdToTargetRecordId;
	
	constructor() {
		this._referenceFields = [];
		this._sourceRecordIdToTargetRecordId = new Map();
	}

	async assignReferences(
		sourceRecords: any[],
		sObjectApiName: string,
		keepField: (fieldMetadata: Field) => boolean
	): Promise<any[]> {
		sourceRecords = structuredClone(sourceRecords);
		const sObjectMetadata = await getSourceDb()
			.sObjectDescribe(sObjectApiName);
		this._referenceFields = sObjectMetadata.fields
			.filter(field => (field.type === 'reference' || field.name === 'Id'))
			.map(field => field.name);

		return sourceRecords.map(record => {
			delete record.attributes;
			for (const fieldName in record) {
				this._deleteNulls(record, fieldName);
				this._assignReferences(record, fieldName);
			}
			sObjectMetadata.fields
				.forEach((fieldMetadata: Field) => {
					!keepField(fieldMetadata) && delete record[fieldMetadata.name]
				});
			return record;
		});
	}

	async addReferencesFromDbResults(
		sourceRecords: any[],
		targetDbResults: SaveResult[],
		treeConfig: TreeConfig
	): Promise<void> {
		sourceRecords = structuredClone(sourceRecords);
		const sourceRecordIdToTargetRecordId = new Map();
		for (let i = 0; i < sourceRecords.length; i++) {
			this._sourceRecordIdToTargetRecordId.set(sourceRecords[i].Id, targetDbResults[i]?.id);
			sourceRecordIdToTargetRecordId.set(sourceRecords[i].Id, targetDbResults[i]?.id);
		}
		if (!treeConfig.requiredReferences) {
			return;
		}
		
		const recordIdToTargetRecord = (await getTargetDb().query(
			new SoqlBuilder().buildSoqlByIds(
				[FieldName.Id, ...treeConfig.requiredReferences],
				treeConfig.apiName,
				[...sourceRecordIdToTargetRecordId.values()]
			)
		)).reduce((recordIdToRecord, record) => {
			if (record.Id) {
				recordIdToRecord[record.Id] = record;
			}
			return recordIdToRecord;
		}, {});

		sourceRecords.forEach(record => {
			const targetRecordId = sourceRecordIdToTargetRecordId.get(record.Id);
			const targetRecord = recordIdToTargetRecord[targetRecordId];
			treeConfig.requiredReferences?.forEach(fieldName => {
				this._sourceRecordIdToTargetRecordId.set(record[fieldName], targetRecord[fieldName]);
			});
		});
	}

	async addReferenceIdMappings(
		treeConfig: TreeConfig,
		dependencyConfigs: TreeConfig[],
		referenceIdMappings: ReferenceIdMapping[]
	): Promise<void> {
		const sObjectTypes = this._extractAllSobjectTypes(
			treeConfig,
			dependencyConfigs
		);
		for (const referenceIdMapping of referenceIdMappings || [{
			sObjectType: SobjectType.RecordType,
			masterField: FieldName.DeveloperName,
			conditionField: FieldName.SobjectType,
			conditionValues: sObjectTypes,
		}]) {
			const refMapSobjectType: string = referenceIdMapping.sObjectType;
			const masterField: string = referenceIdMapping.masterField;
			const conditionFieldName: string = referenceIdMapping.sObjectType === SobjectType.RecordType
				? FieldName.SobjectType
				: referenceIdMapping.conditionField
			const conditionValues: any[] = referenceIdMapping.sObjectType === SobjectType.RecordType
				? [...sObjectTypes]
				: referenceIdMapping.conditionValues

			const soql = new SoqlBuilder().buildSoqlByFieldValues(
				[FieldName.Id, masterField],
				refMapSobjectType,
				conditionFieldName,
				conditionValues
			);
			const sourceRecords: any[] = await getSourceDb().query(soql);
			const masterFieldValueToTargetRecId: Map<any, string> = (await getTargetDb().query(soql))
				.reduce((result, record) => {
					result.set(record[masterField], record.Id)
					return result
				}, new Map());
			sourceRecords.forEach(sourceRecordType => {
				this._sourceRecordIdToTargetRecordId.set(
					sourceRecordType.Id,
					masterFieldValueToTargetRecId.get(sourceRecordType[masterField])
				);
			});
		}
	}

	_extractAllSobjectTypes(
		treeConfig: TreeConfig,
		dependencyConfigs: TreeConfig[],
		sobjectTypes: Set<string> = new Set(),
	): Set<string> {
		sobjectTypes.add(treeConfig.apiName);
		
		if (!treeConfig.children?.length) {
			return sobjectTypes;
		}
		
		for (const childConfig of treeConfig.children || []) {
			sobjectTypes = this._extractAllSobjectTypes(childConfig, [], sobjectTypes);
		}
		for (const dependencyConfig of dependencyConfigs || []) {
			sobjectTypes = this._extractAllSobjectTypes(dependencyConfig, [], sobjectTypes);
		}
		return sobjectTypes;
	}

	_deleteNulls (record: any, fieldName: string) {
		if (record[fieldName] === null || record[fieldName] === undefined) {
			delete record[fieldName];
		}
		return record;
	}

	_assignReferences(record: any, fieldName: string) {
		const fieldValue = record[fieldName];
		if (
			this._referenceFields.includes(fieldName) &&
			this._sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			record[fieldName] = this._sourceRecordIdToTargetRecordId.get(fieldValue);
		} else if (
			this._referenceFields.includes(fieldName) &&
			!this._sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			delete record[fieldName];
		}
		return record;
	}
}