/**
 * @fileoverview Builds import plans for Salesforce data tree import.
 * @module services/import-plan-builder
 */

import { writeFileSync } from 'fs';

/**
 * Service class that builds import plans based on export configuration,
 * organizing records by dependency depth for proper import order.
 */
export class ImportPlanBuilder {
	/**
	 * Creates a new ImportPlanBuilder instance.
	 */
	constructor() {
		this.maxDepth = 0;
	}

	/**
	 * Builds and writes an import plan based on the export configuration.
	 * @param {Object} config - The export configuration object
	 * @returns {void}
	 */
	buildImportPlan(config) {
		const leveledItems = this._buildImportPlan([config]).flat(Infinity);
		let result = [];
		for (let i = 1; i <= this.maxDepth; i++) {
			result = [...result, ...leveledItems.filter(item => item.level === i)];
		}
		result = result.map(item => {
			delete item.level;
			return item;
		});
		writeFileSync(
			`./_output/_import-plan.json`,
			JSON.stringify(result, null, 4)
		);
	}

	/**
	 * Recursively builds import plan items with depth levels.
	 * @private
	 * @param {Array<Object>} configs - Array of configuration objects
	 * @param {number} currentDepth - Current depth level in the hierarchy
	 * @returns {Array} Nested array of import plan items
	 */
	_buildImportPlan(configs = [], currentDepth = 1) {
		if (configs?.length) {
			this.maxDepth = this.maxDepth >= currentDepth ? this.maxDepth : currentDepth;
			return configs.map(config => {
				return [{
					sobject: config.apiName,
					files: [`${config.apiName}.json`],
					level: currentDepth
				}, ...this._buildImportPlan(config.children, currentDepth + 1)]
			});
		}
		return configs;
	}
}
