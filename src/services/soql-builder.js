export class SoqlBuilder {
	constructor(database, treeConfig) {
		this.database = database;
		this.treeConfig = structuredClone(treeConfig);
	}

	async buildSOQL() {
		const fieldsStr = (await this._getFields(this.treeConfig.apiName)).join(',');
		const recordIdList = this.treeConfig.referenceField
			? this.treeConfig?.parentRecordIds.map(id => `'${id}'`).join(',')
			: this.treeConfig?.recordIds.map(id => `'${id}'`).join(',');
		
		if (!recordIdList?.length) {
			return null;
		}

		return `
		SELECT ${fieldsStr}
		FROM ${this.treeConfig.apiName}
		WHERE ${this.treeConfig.referenceField || 'Id'} IN (${recordIdList})` + 
		(this.treeConfig.externalIdField ? ` AND ${this.treeConfig.externalIdField} != NULL` : '');
	}

	async _getFields(sObjectApiName) {
		const sObjectMetadata = await this.database.sObjectDescribe(sObjectApiName);
		
		return sObjectMetadata.fields
			.filter(field => {
				if (field.type === 'id') {
					return true;
				}
				if (!field.createable || this.treeConfig.excludedFields?.includes(field.name)) {
					return false;
				}
				return true;
			})
			.map(field => field.name);
	}
}