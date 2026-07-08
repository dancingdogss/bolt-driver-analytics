\# Bolt Driver Analytics MVP



We are building a Bolt-only driver analytics MVP.



\## Current scope



Use only Bolt CSV trip invoice files.



Do not implement Uber yet.

Do not implement PDF parsing yet.

Do not implement authentication yet.

Do not implement database yet.

Do not implement OCR.

Do not implement tax/accounting logic.



All data should stay local in the browser for now.



\## Uploaded Bolt CSV structure



The CSV headers are Romanian:



\- Factura numărul

\- Dată

\- Adresa de preluare

\- Metoda de plată

\- Data călătoriei

\- Beneficiar

\- Adresa beneficiarului

\- Numărul de înregistrare al beneficiarului

\- Număr TVA beneficiar

\- Nume companie

\- Adresă companie (Stradă, Număr, Cod poștal, Țară)

\- Cod unic de inregistrare

\- Număr TVA companie

\- Valoare (fără TVA)

\- TVA

\- Valoare totală



\## Important parsing rules



Use `Data călătoriei` as the real trip date for analytics.

Do not group analytics by file name.

Deduplicate by `Factura numărul`.

Money values are Romanian-style numbers and must become JavaScript numbers.

Dates are in `dd.MM.yyyy HH:mm` format.

Payment methods found: `Bolt Payment`, `Numerar`, `Business`.



The parser must handle malformed rows where `Adresa de preluare` contains broken commas or quotes. Detect the payment method token to recover the row.



\## Default business assumptions for MVP v1



Car rent: 500 RON per week.

Fleet commission: 10%.

Fuel cost: not implemented yet.

Fuel consumption: not implemented yet.

Other expenses: not implemented yet.



\## MVP estimated profit formula



For v1, use:



grossRevenue = sum(Valoare totală)

fleetCommission = grossRevenue \* 0.10

rentCost = selectedDays \* (500 / 7)

estimatedProfit = grossRevenue - fleetCommission - rentCost



Clearly label this as estimated profit.



\## Dashboard metrics



Show:

\- total revenue

\- total trips

\- average trip value

\- revenue without VAT

\- VAT total

\- cash/card/business split

\- daily revenue

\- hourly revenue

\- weekday performance

\- top pickup addresses

\- fleet commission estimate

\- rent estimate

\- estimated profit



\## Code style



Use TypeScript.

Use clean types.

Use Zod where useful for validation.

Keep components small.

Use Tailwind for UI.

Use Recharts for charts.

Use localStorage for persistence.

