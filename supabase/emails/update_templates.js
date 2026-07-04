const fs = require('fs');
const path = require('path');

const emailsDir = __dirname;
const files = fs.readdirSync(emailsDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(emailsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Update logo size
    content = content.replace(
        /.header .logo { max-height: 48px;/g, 
        ".header .logo { max-height: 80px;"
    );

    // 2. Update btn text color
    content = content.replace(
        /color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px;/g,
        "color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px;"
    );

    // 3. Update header structure (for the files that haven't been updated yet)
    const oldHeader = `      <div class="header">\n        <img src="{{ .SiteURL }}/icon.png" alt="Zeiterfassung Pro Logo" class="logo">\n        <h1>Zeiterfassung Pro</h1>\n      </div>`;
    
    const newHeader = `      <div class="header">\n        {{ if .Data.company_logo_url }}\n          <img src="{{ .Data.company_logo_url }}" alt="{{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }} Logo" class="logo">\n        {{ else }}\n          <img src="{{ .SiteURL }}/icon.png" alt="Zeiterfassung Pro Logo" class="logo">\n          <h1>{{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }}</h1>\n        {{ end }}\n      </div>`;
    
    content = content.replace(oldHeader, newHeader);

    // 4. Update footer
    const oldFooter = `      <div class="footer">\n        &copy; 2026 Zeiterfassung Pro. Alle Rechte vorbehalten.\n      </div>`;
    
    const newFooter = `      <div class="footer">\n        &copy; 2026 {{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }}. Alle Rechte vorbehalten.\n      </div>`;
      
    content = content.replace(oldFooter, newFooter);
    
    // 5. Update title to conditionally include company name
    content = content.replace(
        / - Zeiterfassung Pro<\/title>/g,
        " - {{ if .Data.company_name }}{{ .Data.company_name }}{{ else }}Zeiterfassung Pro{{ end }}</title>"
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
});

console.log("Updated all HTML templates.");
