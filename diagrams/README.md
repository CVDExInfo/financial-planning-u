# Diagrams Directory

This directory contains source diagram files used in the Finanzas SD documentation.

## Supported Formats

### Mermaid Diagrams (.mmd)
Mermaid diagrams are automatically converted to SVG during the documentation build process.

**Example Mermaid diagram:**
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

**Creating Mermaid diagrams:**
1. Create a `.mmd` file in this directory
2. Write your diagram using Mermaid syntax
3. The render-docs script will automatically convert it to SVG
4. Reference in Markdown: `![Diagram Name](../diagrams/your-diagram.svg)`

**Mermaid Documentation**: https://mermaid.js.org/

### Draw.io Diagrams (.drawio)
Draw.io diagrams are currently not automatically processed. If you need to include Draw.io diagrams, please export them to SVG format manually.

**Creating Draw.io diagrams:**
1. Create diagram at https://app.diagrams.net/
2. **Export to SVG**: File → Export as → SVG
3. Save SVG in this directory with a descriptive name
4. Reference in Markdown: `![Diagram Name](../diagrams/your-diagram.svg)`

**Note**: Automated Draw.io conversion is not implemented. Only Mermaid diagrams (.mmd) are automatically converted during the build process.

### SVG Images (.svg)
SVG images can be used directly without conversion.

**Using SVG images:**
1. Place SVG file in this directory
2. Reference in Markdown: `![Image Name](../diagrams/your-image.svg)`

## Naming Conventions

- Use kebab-case for file names: `system-architecture.mmd`
- Use descriptive names: `data-flow-diagram.mmd` not `diagram1.mmd`
- Match diagram name with content
- Keep names consistent between source and output formats

## Bilingual Diagrams

For bilingual documentation, consider:

1. **Bilingual Labels**: Include both languages in diagram text
   ```
   Start / Inicio
   Process / Proceso
   End / Fin
   ```

2. **Separate Diagrams**: Create separate versions for each language
   ```
   system-architecture-en.mmd
   system-architecture-es.mmd
   ```

3. **Language-Neutral**: Use symbols and minimal text
   ```
   Use icons and arrows with minimal text labels
   ```

## Examples

### Example: System Architecture Diagram (Mermaid)

File: `system-architecture.mmd`

```mermaid
graph TB
    UI[Frontend / Frontend]
    API[API Gateway / Gateway API]
    DB[(Database / Base de Datos)]
    
    UI --> API
    API --> DB
```

### Example: Process Flow (Mermaid)

File: `user-onboarding-flow.mmd`

```mermaid
sequenceDiagram
    participant User as User / Usuario
    participant System as System / Sistema
    participant Admin as Admin / Administrador
    
    User->>System: Request Access / Solicitar Acceso
    System->>Admin: Notify / Notificar
    Admin->>System: Approve / Aprobar
    System->>User: Grant Access / Otorgar Acceso
```

## Current Diagrams

- `end-to-end-flow.mmd` - Comprehensive end-to-end process flow showing all actors, components, and interactions with bilingual labels
- `system-architecture.mmd` - High-level system architecture showing main components and their relationships
- `roles-and-responsibilities.mmd` - Role definitions and responsibility matrix for the system

## Quality Standards

Our diagrams follow enterprise-grade quality standards:

- **Professional Styling**: Consistent color schemes, proper spacing, and clear visual hierarchy
- **Bilingual Labels**: All diagrams include English/Spanish labels for international accessibility
- **Clear Typography**: Readable fonts and appropriately sized text
- **Intuitive Flow**: Logical progression and clear relationships between components
- **Modern Aesthetics**: Contemporary design with appropriate use of color, shape, and icons

## Future Enhancements

- [ ] PlantUML support
- [ ] Graphviz DOT file support  
- [ ] Automatic bilingual diagram generation
- [ ] Interactive diagram validation
- [ ] Animated sequence diagrams for presentations

## Contributing

When adding new diagrams:

1. Place source file in this directory
2. Use descriptive file names
3. Include bilingual labels where applicable
4. Reference diagram in relevant documentation
5. Test diagram rendering in generated PDFs/DOCXs

## Tools

- **Mermaid Live Editor**: https://mermaid.live/
- **Draw.io**: https://app.diagrams.net/
- **Mermaid CLI**: Installed automatically by documentation pipeline

## Support

For questions about diagram creation or issues with rendering:
- See `scripts/docs/README.md` for technical details
- Check Mermaid documentation for syntax help
- Contact documentation team for assistance
