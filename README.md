# Salesforce Data Migration CLI Tool

<a href="https://www.linkedin.com/in/akohan">
  <img
    alt="akohan91 | LinkedIn"
    src="https://content.linkedin.com/content/dam/me/business/en-us/amp/xbu/linkedin-revised-brand-guidelines/linkedin-logo/fg/brandg-linkedinlogo-hero-logo-dsk-v01.png.original.png"
    height="28px"
  >
</a>

A powerful command-line tool that simplifies migrating Salesforce data between orgs while automatically preserving parent-child relationships and referential integrity.

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

Built on top of the official Salesforce CLI and JSForce, it provides a configuration-driven approach to data migration that ensures your related records maintain their connections through the export and import process.

---

## Features

✨ **Relationship-Aware Migration** - Automatically handles parent-child relationships between Salesforce objects without manual ID mapping

🎯 **Configuration-Driven** - Define your entire migration structure in a simple JSON file

🔗 **Hierarchical Data Support** - Migrate nested object structures (e.g., Account → Contact → Case → CaseComment)

🎛️ **Field-Level Control** - Exclude specific fields from migration using configuration

🎪 **Selective Record Migration** - Migrate specific records by ID or entire related record sets

⚡ **Built on Official Tools** - Leverages Salesforce CLI for authentication and JSForce for robust API interactions

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
   sf org login web --alias MySandbox
   sf org login web --alias MyDevOrg
   ```

### Quick Start

1. Copy the example configuration:
   ```bash
   cp migration-config.example.json migration-config.json
   ```

2. Edit `migration-config.json` to define your migration structure:
   ```json
   {
     "apiName": "Account",
     "recordIds": ["001XXXXXXXXXXXXXXX"],
     "referenceField": null,
     "excludedFields": [],
     "children": [
       {
         "apiName": "Contact",
         "referenceField": "AccountId",
         "excludedFields": [],
         "children": []
       }
     ]
   }
   ```

3. Run the migration:
   ```bash
   node src/index.js \
     --source-org MySandbox \
     --target-org MyDevOrg \
     --export-config migration-config.json
   ```

4. The tool will:
   - Export records from the source org
   - Generate JSON files in `_output/` directory
   - Create an import plan
   - Display success confirmation
   - Import records to target org

---

## Configuration

The migration configuration file defines the structure of your data migration. Here's an example configuration that migrates an Account with related Contacts, Cases, Opportunities (with Line Items), and Contracts:

```json
{
  "apiName": "Account",
  "recordIds": ["001XXXXXXXXXXXXXXX"],
  "referenceField": null,
  "excludedFields": [],
  "children": [
    {
      "apiName": "Contact",
      "referenceField": "AccountId"
    },
    {
      "apiName": "Case",
      "referenceField": "AccountId",
      "excludedFields": []
    },
    {
      "apiName": "Opportunity",
      "referenceField": "AccountId",
      "excludedFields": [],
      "children": [
        {
          "apiName": "OpportunityLineItem",
          "referenceField": "OpportunityId",
          "excludedFields": []
        }
      ]
    },
    {
      "apiName": "Contract",
      "referenceField": "AccountId",
      "excludedFields": []
    }
  ]
}
```

### Configuration Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `apiName` | string | Yes | The API name of the Salesforce object (e.g., "Account", "Contact") |
| `recordIds` | array | Yes* | Array of specific record IDs to migrate from the parent object |
| `referenceField` | string/null | Yes | The lookup/master-detail field name that references the parent (null for root objects) |
| `excludedFields` | array | No | Array of field API names to exclude from the migration (optional, defaults to empty) |
| `children` | array | No | Array of child object configurations using the same structure (optional, supports nested hierarchies) |

<blockquote><b>NOTE:</b> For root objects (like Account), set <code>referenceField</code> to <code>null</code> and specify <code>recordIds</code>. For child objects, specify the field that references the parent (e.g., <code>"AccountId"</code> for Contact). Child records are automatically queried based on parent record IDs, so <code>recordIds</code> is not needed for children.</blockquote>

---

## How It Works

1. **Connection** - Authenticates to the source Salesforce org using credentials from Salesforce CLI
2. **Query Building** - Dynamically builds SOQL queries based on object metadata and configuration
3. **Data Export** - Retrieves records with all createable fields, respecting exclusions
4. **Formatting** - Transforms records for import, replacing IDs with reference markers
5. **Relationship Mapping** - Maintains parent-child relationships using reference IDs
6. **Plan Generation** - Creates an import plan that ensures proper dependency order
7. **Import** - Uses Salesforce CLI's tree import command to load data into target org

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
