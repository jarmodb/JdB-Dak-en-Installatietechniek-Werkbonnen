function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function num(n) {
  return Number(n || 0).toFixed(2)
}

export function genereerUBL(bon) {
  let regels = []
  let idx = 1

  if (bon.uren > 0) {
    regels.push(`  <cac:InvoiceLine>
    <cbc:ID>${idx++}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">${num(bon.uren)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${num(bon.arbeid)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="EUR">${num(bon.arbeid * 0.21)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="EUR">${num(bon.arbeid)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="EUR">${num(bon.arbeid * 0.21)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>21</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>Arbeid (${bon.uren} uur)</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:Percent>21</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${num(bon.uurtarief)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`)
  }

  for (const m of (bon.materialen || [])) {
    const totaal = (m.aantal || 0) * (m.prijs || 0)
    regels.push(`  <cac:InvoiceLine>
    <cbc:ID>${idx++}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${m.aantal}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${num(totaal)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="EUR">${num(totaal * 0.21)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="EUR">${num(totaal)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="EUR">${num(totaal * 0.21)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>21</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${esc(m.omschrijving)}</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:Percent>21</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${num(m.prijs)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>${esc(bon.nummer)}</cbc:ID>
  <cbc:IssueDate>${bon.datum || new Date().toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Jordy - Loodgieter &amp; Dakdekker</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(bon.klant_naam)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(bon.klant_adres)}</cbc:StreetName>
        <cbc:PostalZone>${esc(bon.klant_postcode)}</cbc:PostalZone>
        <cbc:CityName>${esc(bon.klant_plaats)}</cbc:CityName>
        <cac:Country><cbc:IdentificationCode>NL</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${num(bon.btw)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${num(bon.excl_btw)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${num(bon.btw)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>21</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${num(bon.excl_btw)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${num(bon.excl_btw)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${num(bon.totaal_incl)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${num(bon.totaal_incl)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${regels.join('\n')}
</Invoice>`
}
