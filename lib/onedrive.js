let msalInstance = null

async function getMsal() {
  if (typeof window === 'undefined') return null
  if (!process.env.NEXT_PUBLIC_AZURE_CLIENT_ID) return null
  if (!msalInstance) {
    const { PublicClientApplication } = await import('@azure/msal-browser')
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
    })
    await msalInstance.initialize()
  }
  return msalInstance
}

const SCOPES = ['Files.ReadWrite']

export async function msLogin() {
  const msal = await getMsal()
  const result = await msal.loginPopup({ scopes: SCOPES })
  return result.account
}

export async function msLogout() {
  const msal = await getMsal()
  const account = msal?.getAllAccounts()[0]
  if (account) await msal.logoutPopup({ account })
  msalInstance = null
}

export async function msGetAccount() {
  const msal = await getMsal()
  if (!msal) return null
  return msal.getAllAccounts()[0] || null
}

async function getToken() {
  const msal = await getMsal()
  const account = msal.getAllAccounts()[0]
  if (!account) throw new Error('Niet ingelogd bij Microsoft')
  try {
    const result = await msal.acquireTokenSilent({ scopes: SCOPES, account })
    return result.accessToken
  } catch {
    const result = await msal.acquireTokenPopup({ scopes: SCOPES, account })
    return result.accessToken
  }
}

// Maakt een veilige mapnaam: "{nummer} - {klantnaam}"
function mapNaam(werkbonNummer, klantNaam) {
  const veilig = (klantNaam || '').replace(/[<>:"/\\|?*]/g, '').trim()
  return veilig ? `${werkbonNummer} - ${veilig}` : werkbonNummer
}

// Bouwt een Graph API URL met correct geëncoded pad-segmenten
function graphPad(...segmenten) {
  const pad = segmenten.map(s => encodeURIComponent(s)).join('/')
  return `https://graph.microsoft.com/v1.0/me/drive/root:/${pad}:/content`
}

export async function uploadFotoNaarOneDrive(file, werkbonNummer, klantNaam) {
  const token = await getToken()
  const url = graphPad('Werkbonnen', mapNaam(werkbonNummer, klantNaam), file.name)

  const uploadRes = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
    body: file,
  })
  if (!uploadRes.ok) throw new Error('Upload mislukt')
  const item = await uploadRes.json()

  // Maak anonieme view-link
  const linkRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/createLink`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'view', scope: 'anonymous' }),
    }
  )
  const linkData = await linkRes.json()

  return {
    naam: file.name,
    itemId: item.id,
    webUrl: item.webUrl,
    shareUrl: linkData.link?.webUrl || item.webUrl,
    datum: new Date().toISOString(),
  }
}

export async function uploadPdfNaarOneDrive(pdfBlob, werkbonNummer, klantNaam) {
  const token = await getToken()
  const bestandsnaam = `${werkbonNummer}.pdf`
  const url = graphPad('Werkbonnen', mapNaam(werkbonNummer, klantNaam), bestandsnaam)

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
    body: pdfBlob,
  })
  if (!res.ok) throw new Error(`PDF upload mislukt (${res.status})`)
}
