const GRAPH = "https://graph.microsoft.com/v1.0"
const SITE_HOST = "goexpcomp.sharepoint.com"
const SITE_PATH = "/sites/DATACENTER"
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import isoWeek from 'dayjs/plugin/isoWeek'
dayjs.extend(utc)
dayjs.extend(isoWeek)

async function getToken(instance, accounts, loginRequest) {
  const token = await instance.acquireTokenSilent({
    ...loginRequest, account: accounts[0]
  })
  return token.accessToken
}

function hdrs(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

let cachedSiteId = null

async function getSiteId(token) {
  if (cachedSiteId) return cachedSiteId
  const res = await fetch(
    `${GRAPH}/sites/${SITE_HOST}:${SITE_PATH}`,
    { headers: hdrs(token) }
  )
  const data = await res.json()
  cachedSiteId = data.id
  return data.id
}

async function getListItems(token, siteId, listName) {
  let url = `${GRAPH}/sites/${siteId}/lists/${encodeURIComponent(listName)}/items?expand=fields&$top=2000`
  let items = []

  while (url) {
    const res = await fetch(url, { headers: hdrs(token) })
    const data = await res.json()
    if (!data.value) {
      console.error(`Error lista ${listName}:`, JSON.stringify(data))
      return []
    }
    items = items.concat(data.value.map(i => i.fields))
    url = data['@odata.nextLink'] || null
  }
  return items
}

export async function getProyectos(instance, accounts, loginRequest) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)

  const url = `${GRAPH}/sites/${siteId}/lists/Proyectos/items?$expand=fields&$filter=(fields/field_10 eq 'Opportunity' or fields/field_10 eq 'Active' or fields/field_10 eq 'CCSS')&$orderby=fields/field_1 asc`

  const res = await fetch(url, { headers: hdrs(token) })
  const data = await res.json()

  if (!data.value) {
    console.error('Error proyectos:', data)
    return []
  }

  return data.value.map(i => ({
    id: i.id,
    ...i.fields
  }))
}

export async function getNomina(instance, accounts, loginRequest) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  return getListItems(token, siteId, 'Nomina_Go')
}

export async function getDeliveryManagers(instance, accounts, loginRequest) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  return getListItems(token, siteId, 'Delivery Managers')
}

export async function getOperationalManagers(instance, accounts, loginRequest) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  return getListItems(token, siteId, 'Operational Managers')
}

export async function getAsignaciones(instance, accounts, loginRequest) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  return getListItems(token, siteId, 'Resource_Planning')
}

export async function crearAsignacion(instance, accounts, loginRequest, fields) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  const res = await fetch(
    `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items`,
    { method: 'POST', headers: hdrs(token), body: JSON.stringify({ fields }) }
  )
  return res.json()
}

export async function actualizarAsignacion(instance, accounts, loginRequest, itemId, fields) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  const res = await fetch(
    `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items/${itemId}/fields`,
    { method: 'PATCH', headers: hdrs(token), body: JSON.stringify(fields) }
  )
  return res.json()
}

export async function eliminarAsignacion(instance, accounts, loginRequest, itemId) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  await fetch(
    `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items/${itemId}`,
    { method: 'DELETE', headers: hdrs(token) }
  )
}

export async function getAsignacionesByProyecto(instance, accounts, loginRequest, proyectoId) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  const url = `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items?expand=fields($expand=Consultor)&$filter=fields/ID_Proyecto eq ${proyectoId}&$top=500`
  const res = await fetch(url, { headers: hdrs(token) })
  const data = await res.json()
  if (!data.value) { console.error(data); return [] }
  // FIX: incluimos el id del item (necesario para eliminar/actualizar)
  return data.value.map(i => ({ id: i.id, ...i.fields }))
}

// FIX: trae TODAS las asignaciones Hard de un consultor en una sola llamada.
// El filtrado por semana se hace localmente en el componente.
// Esto reemplaza getAsignacionesConsultorSemana para el cálculo de disponibilidad.
export async function getTodasAsignacionesHardConsultor(instance, accounts, loginRequest, consultorId) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  const url = `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items?expand=fields&$filter=fields/ConsultorLookupId eq ${consultorId} and fields/Tipo_Asignacion eq 'Hard'&$top=999`
  const res = await fetch(url, { headers: hdrs(token) })
  const data = await res.json()
  if (!data.value) { console.error(data); return [] }
  return data.value.map(i => ({ id: i.id, ...i.fields }))
}

// Se mantiene para compatibilidad con ModalNuevoConsultor
export async function getAsignacionesConsultorSemana(instance, accounts, loginRequest, consultorId, semana) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)
  const url = `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items?expand=fields&$filter=fields/ConsultorLookupId eq ${consultorId} and fields/Tipo_Asignacion eq 'Hard'&$top=500`
  const res = await fetch(url, { headers: hdrs(token) })
  const data = await res.json()
  if (!data.value) { console.error(data); return [] }
  const semanaISO = dayjs.utc(semana).startOf('isoWeek').format('YYYY-MM-DD')
  return data.value
    .map(i => ({ id: i.id, ...i.fields }))
    .filter(f => dayjs.utc(f.Semana).startOf('isoWeek').format('YYYY-MM-DD') === semanaISO)
}

// FIX: EmpleadoLookupId ahora incluido en $select y normalizado con fallback a i.id
export async function getNominaActiva(instance, accounts, loginRequest) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)

  const url = `${GRAPH}/sites/${siteId}/lists/Nomina_Go/items?$top=5000&$expand=fields($select=field_0,field_11,Empleado,EmpleadoLookupId,Email)`

  const res = await fetch(url, { headers: hdrs(token) })
  const data = await res.json()

  if (!data.value) {
    console.error('Error nómina:', data)
    return []
  }

  const todos = data.value.map(i => ({
    id: i.id,
    ...i.fields,
    // EmpleadoLookupId puede no venir en fields; fallback al id del list item
    EmpleadoLookupId: i.fields.EmpleadoLookupId ?? i.id
  }))

  const activos = todos
    .filter(n => (n.field_11 || '').toLowerCase().trim() === 'activo')
    .sort((a, b) => (a.field_0 || a.Empleado || '').localeCompare(b.field_0 || b.Empleado || ''))

  const tbds = todos
    .filter(n => (n.field_11 || '').toLowerCase().includes('tbd'))
    .sort((a, b) => (a.field_0 || a.Empleado || '').localeCompare(b.field_0 || b.Empleado || ''))

  return [...activos, ...tbds]
}

export async function crearAsignacionConPersona(instance, accounts, loginRequest, fields, userEmail) {
  const token = await getToken(instance, accounts, loginRequest)
  const siteId = await getSiteId(token)

  let userId = null
  if (userEmail) {
    try {
      const userRes = await fetch(
        `${GRAPH}/users/${userEmail}`,
        { headers: hdrs(token) }
      )
      const userData = await userRes.json()
      userId = userData.id
    } catch (e) {
      console.error('No se pudo obtener usuario de Azure AD:', e)
    }
  }

  const res = await fetch(
    `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items`,
    { method: 'POST', headers: hdrs(token), body: JSON.stringify({ fields }) }
  )
  const newItem = await res.json()

  if (userId && newItem.id) {
    await fetch(
      `${GRAPH}/sites/${siteId}/lists/Resource_Planning/items/${newItem.id}/fields`,
      {
        method: 'PATCH',
        headers: hdrs(token),
        body: JSON.stringify({ ConsultorLookupId: parseInt(fields.ConsultorLookupId) })
      }
    )
  }

  return newItem
}