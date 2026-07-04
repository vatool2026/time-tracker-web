import os
import glob

# The directory containing the html files
emails_dir = r"c:\Users\info\OneDrive\Desktop\Anti Project\time-tracker-web\supabase\emails"
html_files = glob.glob(os.path.join(emails_dir, "*.html"))

for file_path in html_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update logo size
    content = content.replace(
        ".header .logo { max-height: 48px;", 
        ".header .logo { max-height: 80px;"
    )

    # 2. Update btn text color
    content = content.replace(
        "color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px;",
        "color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px;"
    )

    # 3. Update header structure (for the files that haven't been updated yet)
    # The unmodified files have this block:
    old_header = """      <div class="header">
        <img src="{{ .SiteURL }}/icon.png" alt="Zeiterfassung Pro Logo" class="logo">
        <h1>Zeiterfassung Pro</h1>
      </div>"""
    
    new_header = """      <div class="header">
        {{ if .Data.company_logo_url }}
          <img src="{{ .Data.company_logo_url }}" alt="{{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }} Logo" class="logo">
        {{ else }}
          <img src="{{ .SiteURL }}/icon.png" alt="Zeiterfassung Pro Logo" class="logo">
          <h1>{{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }}</h1>
        {{ end }}
      </div>"""
    
    content = content.replace(old_header, new_header)

    # 4. Update footer
    old_footer = """      <div class="footer">
        &copy; 2026 Zeiterfassung Pro. Alle Rechte vorbehalten.
      </div>"""
    
    new_footer = """      <div class="footer">
        &copy; 2026 {{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }}. Alle Rechte vorbehalten.
      </div>"""
      
    content = content.replace(old_footer, new_footer)
    
    # 5. Update title to conditionally include company name
    # We can do this with a regex or simple string replacement since they all end with " - Zeiterfassung Pro</title>"
    content = content.replace(
        " - Zeiterfassung Pro</title>",
        " - {{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }}</title>"
    )
    
    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated all HTML templates.")
