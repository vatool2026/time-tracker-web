import pandas as pd
import urllib.request
import sys

url = "https://docs.google.com/spreadsheets/d/1l_W_5WhTFwjj88U4IO-FJIb0a8xZK7E9_m97tiZ9GVk/export?format=xlsx"
try:
    urllib.request.urlretrieve(url, "sheet.xlsx")
    xls = pd.ExcelFile("sheet.xlsx")
    for sheet_name in xls.sheet_names:
        if sheet_name in ["Jan", "Feb", "März", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]:
            df = pd.read_excel(xls, sheet_name=sheet_name)
            # The summary is usually at the top right or bottom. Let's look for "Übertrag in den nächsten Monat"
            print(f"--- Sheet: {sheet_name} ---")
            for index, row in df.iterrows():
                row_str = " | ".join([str(x) for x in row.values if pd.notna(x)])
                if "SOLL Arbeitszeit" in row_str or "IST Arbeitszeit" in row_str or "Übertrag" in row_str or "ausgezahlt" in row_str:
                    print(row_str)
            print("\n")
except Exception as e:
    print("Error:", e)
