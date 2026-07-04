const https = require('https');
const fs = require('fs');
const xlsx = require('xlsx');

const url = "https://docs.google.com/spreadsheets/d/1l_W_5WhTFwjj88U4IO-FJIb0a8xZK7E9_m97tiZ9GVk/export?format=xlsx";

https.get(url, (res) => {
    // google drive redirects, so handle 302
    if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 303) {
        https.get(res.headers.location, (res2) => {
            const file = fs.createWriteStream("sheet.xlsx");
            res2.pipe(file);
            file.on('finish', () => {
                file.close();
                analyze();
            });
        });
    } else {
        const file = fs.createWriteStream("sheet.xlsx");
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            analyze();
        });
    }
});

function analyze() {
    try {
        const workbook = xlsx.readFile('sheet.xlsx');
        const targetSheets = ["Jan", "Feb", "März", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
        for (const sheetName of workbook.SheetNames) {
            if (targetSheets.includes(sheetName)) {
                console.log(`--- Sheet: ${sheetName} ---`);
                const sheet = workbook.Sheets[sheetName];
                const json = xlsx.utils.sheet_to_json(sheet, {header: 1, raw: false});
                for (const row of json) {
                    const rowStr = row.join(' | ');
                    if (rowStr.includes('SOLL Arbeitszeit') || rowStr.includes('IST Arbeitszeit') || rowStr.includes('Übertrag') || rowStr.includes('ausgezahlt')) {
                        console.log(rowStr);
                    }
                }
                console.log("\n");
            }
        }
    } catch (e) {
        console.error("Error analyzing:", e.message);
    }
}
