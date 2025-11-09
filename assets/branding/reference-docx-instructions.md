# DOCX Reference Template

This file should be replaced with an actual Microsoft Word (.docx) reference document.

## How to Create the Reference Template

1. **Open Microsoft Word**

2. **Configure Page Setup:**
   - Paper size: A4
   - Margins: Normal (1 inch / 2.54 cm on all sides)

3. **Add Header:**
   - Insert → Header → Blank
   - Add company logo (left-aligned)
   - Add document title placeholder (right-aligned)
   - Use corporate font (e.g., Arial, Calibri, or custom corporate font)

4. **Add Footer:**
   - Insert → Footer → Blank
   - Add "Finanzas SD Documentation" text (left)
   - Add page number (right): "Page X of Y"
   - Use corporate font and color

5. **Define Styles:**
   - **Heading 1**: 
     - Font: Bold, 24pt
     - Color: Corporate blue (#003366)
     - Spacing: Before 18pt, After 12pt
   
   - **Heading 2**: 
     - Font: Bold, 18pt
     - Color: Corporate blue (#0066CC)
     - Spacing: Before 12pt, After 6pt
   
   - **Heading 3**: 
     - Font: Bold, 14pt
     - Color: Black
     - Spacing: Before 6pt, After 3pt
   
   - **Body Text**:
     - Font: Regular, 11pt
     - Color: Black
     - Line spacing: 1.15 or 1.5
     - Spacing: After 6pt
   
   - **Code/Monospace**:
     - Font: Courier New or Consolas, 10pt
     - Background: Light gray (#F6F8FA)
   
   - **Table Grid**:
     - Border: 1pt solid #DFE2E5
     - Header: Bold, background #003366, text white

6. **Set Theme Colors:**
   - Design → Colors → Customize Colors
   - Set primary colors to match corporate branding

7. **Save the File:**
   - File → Save As
   - Format: Word Document (*.docx)
   - Location: `assets/branding/reference.docx`

## Notes

- The reference.docx file is used by Pandoc with the `--reference-doc` option
- All styles defined in this file will be applied to generated DOCX documents
- Images and logos in the header/footer will appear in all generated documents
- Keep the file size small by not including sample content, only styles

## Alternative: Use Provided Template

If you don't have Microsoft Word, you can:
1. Use LibreOffice Writer (free alternative)
2. Download a template from the Pandoc documentation
3. Modify an existing corporate template

## Testing the Template

After creating reference.docx, test it:

```bash
pandoc test.md -o test.docx --reference-doc=assets/branding/reference.docx
```

Open test.docx and verify:
- Styles are applied correctly
- Header and footer appear on all pages
- Colors match corporate branding
- Fonts are correct
