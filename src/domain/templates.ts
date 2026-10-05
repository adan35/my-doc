/** Built-in document templates. Data-driven: adding a template is adding an entry here. */

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Suggested file name (without extension); `{{date}}` is expanded. */
  fileName: string;
  body: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank document',
    description: 'Start from an empty page.',
    fileName: 'Untitled',
    body: '# {{title}}\n\n',
  },
  {
    id: 'readme',
    name: 'README',
    description: 'Project overview with setup and usage.',
    fileName: 'README',
    body: `# {{title}}

A short description of what this project does and who it is for.

## Getting started

\`\`\`bash
# install
\`\`\`

## Usage

## Contributing

## License
`,
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Agenda, notes, decisions and action items.',
    fileName: 'Meeting {{date}}',
    body: `# {{title}}

- **Date:** {{date}}
- **Attendees:** 

## Agenda

1. 

## Notes

## Decisions

## Action items

- [ ] 
`,
  },
  {
    id: 'project',
    name: 'Project documentation',
    description: 'Goals, scope, architecture and milestones.',
    fileName: 'Project overview',
    body: `# {{title}}

Created: {{date}}

## Overview

## Goals

## Scope

## Architecture

## Milestones

| Milestone | Owner | Due |
| --- | --- | --- |
|  |  |  |

## Open questions
`,
  },
  {
    id: 'api',
    name: 'API documentation',
    description: 'Endpoints, parameters and examples.',
    fileName: 'API',
    body: `# {{title}}

## Authentication

## Endpoints

### \`GET /resource\`

Returns a list of resources.

**Query parameters**

| Name | Type | Description |
| --- | --- | --- |
| \`limit\` | number | Maximum number of results |

**Response**

\`\`\`json
{
  "items": []
}
\`\`\`

## Errors
`,
  },
  {
    id: 'research',
    name: 'Research notes',
    description: 'Question, sources, findings and conclusions.',
    fileName: 'Research notes',
    body: `# {{title}}

Created: {{date}}

## Question

## Sources

- 

## Findings

## Conclusions

## References
`,
  },
  {
    id: 'lecture',
    name: 'Lecture notes',
    description: 'Course, key ideas, formulas and questions to review.',
    fileName: 'Lecture {{date}}',
    body: `# {{title}}

- **Course:** 
- **Date:** {{date}}

## Key ideas

- 

## Formulas

$$
E = mc^2
$$

## Questions to review

- [ ] 

#lecture
`,
  },
  {
    id: 'daily',
    name: 'Daily note',
    description: 'Focus, tasks and notes for today.',
    fileName: '{{date}}',
    body: `# {{title}}

## Focus

## Tasks

- [ ] 

## Notes
`,
  },
  {
    id: 'todo',
    name: 'Todo list',
    description: 'A simple checklist.',
    fileName: 'Todo',
    body: `# {{title}}

- [ ] 
`,
  },
];

export function isoDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function expandTemplate(text: string, vars: { title: string; date?: string }): string {
  const date = vars.date ?? isoDate();
  return text.replace(/\{\{\s*(title|date)\s*\}\}/g, (_m, key: string) =>
    key === 'title' ? vars.title : date,
  );
}
