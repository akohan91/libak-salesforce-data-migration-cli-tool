# Salesforce Data Migration CLI Tool

<a href="https://www.linkedin.com/in/akohan">
  <img
    alt="akohan91 | LinkedIn"
    src="https://content.linkedin.com/content/dam/me/business/en-us/amp/xbu/linkedin-revised-brand-guidelines/linkedin-logo/fg/brandg-linkedinlogo-hero-logo-dsk-v01.png.original.png"
    height="28px"
  >
</a>

A powerful command-line tool that simplifies migrating Salesforce data between orgs while automatically preserving parent-child relationships and referential integrity.

> **Special Thanks:** Inspired by [Pawel Kalinowski](https://www.linkedin.com/in/pawel-kalinowski-3050a412b/)

---

## Table of Contents

- [Project Description](#project-description)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Project Description

The Salesforce Data Migration CLI Tool is designed for developers and administrators who need to replicate complex data structures between Salesforce orgs. Whether you're setting up sandbox environments, migrating sample data, or creating test datasets, this tool automatically handles the intricate relationships between your Salesforce records.

Built on top of JSForce, it provides a configuration-driven approach to data migration that ensures your related records maintain their connections through the export and import process.

---

## Features

✨ **Relationship-Aware Migration** - Automatically handles parent-child relationships between Salesforce objects without manual ID mapping

🎯 **Configuration-Driven** - Define your entire migration structure in a simple JSON file

🔗 **Hierarchical Data Support** - Migrate nested object structures (e.g., Account → Contact → Case → CaseComment)

🎛️ **Field-Level Control** - Exclude specific fields from migration using configuration

🎪 **Selective Record Migration** - Migrate specific records by ID or entire related record sets

⚡ **Built on JSforce** - Uses JSforce database operations (insert, update, upsert, delete) for direct API control

🔄 **Upsert Support** - Configure external ID fields for idempotent migrations and incremental updates

🔍 **Detailed Error Reporting & Rollback** - Unified error reporting for all DML operations, with automatic rollback of inserted records on failure. Error messages include status codes and affected fields for each failed record.

🔬 **Reference Analyzer & Dependency Config Generation** - Analyze your data structure to discover field-level relationships and auto-generate dependency configs before migration. Skips specified SObject dependencies and main tree record IDs.

🎭 **Automatic RecordType Mapping** - Intelligently maps RecordTypes between orgs using DeveloperName matching

💎 **TypeScript Support** - Full TypeScript implementation with strict type-checking for enhanced developer experience and code reliability

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **Salesforce CLI** (`sf`) - [Install guide](https://developer.salesforce.com/tools/salesforcecli)
- **Salesforce Orgs** - Source and target orgs with proper authentication

### Installation

1. Clone the repository:

```bash
   git clone https://github.com/akohan91/libak-salesforce-data-migration-cli-tool.git
   cd libak-salesforce-data-migration-cli-tool
```

2. Install dependencies:

```bash
   npm install
```

3. Authenticate your Salesforce orgs with the Salesforce CLI:

```bash
sf org login web \
  --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com \
  --set-default \
  --alias MySandbox

sf org login web \
  --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com \
  --set-default \
  --alias MyDevOrg
```

### Quick Start

1. Copy the example configuration:

```bash
   cp migration-config.example.json migration-config.json
```

2. Edit `migration-config.json` to define your migration structure:

```json
   {
     "dependencyConfig": [],
     "treeConfig": {
       "apiName": "Account",
       "externalIdField": "BackendId__c",
       "recordIds": ["001XXXXXXXXXXXXXXX"],
       "referenceField": null,
       "excludedFields": [],
       "requiredReferences": ["PersonContactId"],
       "children": [
         {
           "apiName": "Contact",
           "externalIdField": "BackendId__c",
           "referenceField": "AccountId"
         }
       ]
     }
   }
```

3. Run the migration:

```bash
   npm run dev -- \
     --source-org MySandbox \
     --target-org MyDevOrg \
     --export-config migration-config.json
```

   **Optional flags:**
   - `--analyze-references` - Analyze reference fields and auto-generate dependency configs without migrating data

   **Alternative:** You can also run TypeScript directly:

```bash
   npx tsx src/index.ts --source-org MySandbox --target-org MyDevOrg --export-config migration-config.json
```

4. Monitor the migration process:

```
🚀 Salesforce Data Migration Tool

📡 Connecting to Salesforce orgs...
    ✅ Successfully connected to source and target orgs

📄 Loading export configuration...
    ✅ Configuration loaded: migration-config.json

📥 Including Record Type references...
    ✅ Record Type references included successfully

🔄 Migration dependencies...
    ⚠️  no dependencies configured.
✅ Migration dependencies completed...

🔄 Migration main tree...
    ✅ Inserted 1 Account record: 001xx000003DGbAAA1
    ✅ Inserted 3 Contact records: 003xx000004DGbAAA1, 003xx000004DGbAAA2, 003xx000004DGbAAA3

🔄 Updating record references...
    ✅ Updated 1 Account record: 001xx000003DGbAAA1
    ✅ Updated 3 Contact records: 003xx000004DGbAAA1, 003xx000004DGbAAA2, 003xx000004DGbAAA3

✅ Migration main tree completed...
```

---

## Configuration

The migration configuration file defines the structure of your data migration. Here's an example configuration that migrates an Account with related Contacts, Cases, Opportunities (with Line Items), and Contracts:

```json
{
  "dependencyConfig": [],
  "treeConfig": {
    "apiName": "Account",
    "externalIdField": "",
    "recordIds": ["001XXXXXXXXXXXXXXX"],
    "referenceField": null,
    "excludedFields": [],
    "children": [
      {
        "apiName": "Contact",
        "externalIdField": "",
        "referenceField": "AccountId"
      },
      {
        "apiName": "Case",
        "externalIdField": "",
        "referenceField": "AccountId",
        "excludedFields": []
      },
      {
        "apiName": "Opportunity",
        "externalIdField": "",
        "referenceField": "AccountId",
        "excludedFields": [],
        "children": [
          {
            "apiName": "OpportunityLineItem",
            "externalIdField": "",
            "referenceField": "OpportunityId",
            "excludedFields": []
          }
        ]
      },
      {
        "apiName": "Contract",
        "externalIdField": "",
        "referenceField": "AccountId",
        "excludedFields": []
      }
    ]
  }
}
```

### Configuration Properties

#### Root Level Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `dependencyConfig` | array | No | Array of tree configurations for prerequisite objects that must be migrated before the main tree (e.g., Products for PricebookEntries) |
| `treeConfig` | object | Yes | Configuration for the main hierarchical (tree-based) data migration |

#### Tree Config Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `apiName` | string | Yes | The API name of the Salesforce object (e.g., "Account", "Contact") |
| `externalIdField` | string | No | External ID field name for upsert operations. Leave empty for insert. |
| `recordIds` | array | Yes* | Array of specific record IDs to migrate from the parent object |
| `referenceField` | string | No | The lookup/master-detail field name that references the parent (null for root objects) |
| `excludedFields` | array | No | Array of field API names to exclude from the migration (optional, defaults to empty) |
| `requiredReferences` | array | No | Array of reference field names to force retrieve after insertion (e.g., `["PersonContactId"]` for Person Accounts) |
| `children` | array | No | Array of child object configurations using the same structure (optional, supports nested hierarchies) |

<blockquote><b>NOTE:</b> For root objects (like Account), set <code>referenceField</code> to <code>null</code> and specify <code>recordIds</code>. For child objects, specify the field that references the parent (e.g., <code>"AccountId"</code> for Contact). Child records are automatically queried based on parent record IDs, so <code>recordIds</code> is not needed for children.</blockquote>

<blockquote><b>UPSERT MODE:</b> When <code>externalIdField</code> is specified with a valid external ID field name, the tool will perform upsert operations instead of inserts. This enables idempotent migrations - running the same migration multiple times will update existing records instead of creating duplicates. Records without a value in the external ID field are automatically excluded from the migration.</blockquote>

<blockquote><b>REQUIRED REFERENCES:</b> Use <code>requiredReferences</code> to specify reference fields that are automatically generated by Salesforce and needed for child record migrations. For example, Person Accounts automatically create a <code>PersonContactId</code> field that can be used to link related records. The tool queries the target org after insertion to retrieve these generated references and includes them in the ID mapping for child records.</blockquote>


## CLI Commands

### Standard Migration

Migrate data from source to target org:

```bash
npm run dev -- \
  --source-org MySandbox \
  --target-org MyDevOrg \
  --export-config migration-config.json
```

### Reference Analyzer & Dependency Config Generation

Analyze reference fields in your data structure and auto-generate dependency configs for non included in the main "treeConfig" without performing migration:

```bash
npm run dev -- \
  --source-org MySandbox \
  --target-org MyDevOrg \
  --export-config migration-config.json \
  --analyze-references
```

The reference analyzer:
- Scans all records in the source org specified in your configuration
- Identifies populated reference fields across all objects
- Resolves target SObject types for each reference field (handles polymorphic lookups)
- Automatically detects external ID fields for each referenced object
- Collects all referenced record IDs per object type
- **Generates ready-to-use dependency configurations** in formatted JSON
- Skips specified SObject dependencies and main tree record IDs

**Output includes:**
1. Field-to-SObject relationship map (e.g., `Account.OwnerId` → `User`)
2. Unique set of all referenced SObject types
3. Complete dependency configuration JSON with:
   - SObject API names
   - Detected external ID fields
   - All referenced record IDs

This helps you understand your data structure and automatically generates the `dependencyConfig` array for complex migrations.

---

## How It Works

1. **Connection** - Authenticates to source and target Salesforce orgs using credentials from Salesforce CLI
2. **Dependency Migration** - Processes `dependencyConfig` array first, migrating prerequisite objects in specified order
3. **RecordType Mapping** - Automatically maps RecordTypes between orgs using DeveloperName for org-independent matching (per configuration)
4. **Query Building** - Dynamically builds SOQL queries based on object metadata and configuration
5. **Hierarchical Processing** - Traverses the tree configuration from parent to children recursively
6. **Data Export** - Retrieves records with all createable fields, respecting exclusions and external ID filters
7. **Record Insertion** - Uses JSforce to insert or upsert records directly into the target org
8. **Reference Tracking** - Maps source record IDs to target record IDs as records are created (including RecordTypes)
9. **Reference Resolution** - Updates lookup/master-detail fields in a second pass using the ID mapping
10. **Error Handling & Rollback** - Reports detailed errors for each failed record with status codes and field-level messages. Automatically rolls back inserted records on failure to maintain data integrity.

---

## Contributing

Contributions are welcome! Whether you're fixing bugs, improving documentation, or adding new features, your help makes this tool better for everyone.

### Contribution Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** your changes: `git commit -m 'Add some feature'`
4. **Push** to the branch: `git push origin feature/your-feature-name`
5. **Submit** a pull request

### Branch Naming Conventions

- Feature: `feature/short-description`
- Bug Fix: `bugfix/short-description`
- Documentation: `docs/short-description`

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contact

**Andrei Kakhanouski** - [LinkedIn](https://www.linkedin.com/in/akohan)

Have questions or want to collaborate? Feel free to reach out or open an issue on GitHub!

---

<p align="center">Made with ❤️ for the Salesforce Community</p>
