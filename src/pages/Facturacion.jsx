// ============================================
// Facturacion.jsx — Hitos de facturación del proyecto
// ============================================

import { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'
import { getHitosFacturacion, getCompanias, getClientes } from '../services/graphService'
import dayjs from 'dayjs'

// ── Paleta GoSCM ──
const C = {
  navy: '#1a3a6e',
  blue: '#2557a7',
  blueLight: '#e8eef8',
  blueAccent: '#3b72d9',
  bg: '#f4f6f9',
  surface: '#fff',
  border: '#dde2ea',
  border2: '#c8d0dc',
  text: '#1e2a3a',
  muted: '#6b7c93',
  faint: '#9eaabb',
  green: '#1a6640', greenLight: '#e6f4ed', greenAccent: '#2e9e63',
  orange: '#8a4a00', orangeLight: '#fff3e0', orangeAccent: '#d97706',
  red: '#8b1a1a', redLight: '#fdeaea', redAccent: '#e53935',
  purple: '#4a1a8a', purpleLight: '#f0eaff', purpleAccent: '#7c3aed',
  teal: '#0a5a5a', tealLight: '#e0f4f4', tealAccent: '#0e9090',
  mono: "'DM Mono', 'Courier New', monospace",
  sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

// ── Configuración de estados ──
const STATUS_CONFIG = {
  'Invoiced':            { bg: C.blueLight,   color: C.blue,   border: C.blueAccent,   label: 'Facturado' },
  'Overdue invoice':     { bg: C.redLight,    color: C.red,    border: C.redAccent,    label: 'FC vencida' },
  'Paid':                { bg: C.greenLight,  color: C.green,  border: C.greenAccent,  label: 'Pagado' },
  'Overdue payment':     { bg: C.orangeLight, color: C.orange, border: C.orangeAccent, label: 'Pago vencido' },
  'Payment confirmed':   { bg: C.tealLight,   color: C.teal,   border: C.tealAccent,   label: 'Pago confirmado' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { bg: C.bg, color: C.muted, border: C.border, label: status || '—' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: '9px',
      fontSize: '9px', fontWeight: 700,
      fontFamily: C.mono,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function formatMonto(monto, currency) {
  if (monto == null) return '—'
  const fmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const simbolo = currency === 'USD' ? 'USD ' : currency === 'EUR' ? '€ ' : currency ? `${currency} ` : ''
  return `${simbolo}${fmt.format(monto)}`
}

function formatFecha(fecha) {
  if (!fecha) return '—'
  return dayjs(fecha).format('DD-MMM-YYYY')
}

// ── KPI Card ──
function KpiCard({ label, valor, sub, color }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
      padding: '12px 14px',
      boxShadow: '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.05)'
    }}>
      <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: C.mono, marginTop: '3px', color: color || C.navy }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: '9.5px', color: C.faint, marginTop: '1px', fontFamily: C.mono }}>{sub}</div>}
    </div>
  )
}

export default function Facturacion({ proyecto }) {
  const { instance, accounts } = useMsal()
  const [hitos, setHitos] = useState([])
  const [companias, setCompanias] = useState({})
  const [clientes, setClientes] = useState({})
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const proyectoId = proyecto.id || proyecto.ID

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const [h, comps, clis] = await Promise.all([
          getHitosFacturacion(instance, accounts, loginRequest, proyectoId),
          getCompanias(instance, accounts, loginRequest),
          getClientes(instance, accounts, loginRequest),
        ])
        // Mapas id → nombre para lookup rápido
        const compMap = {}
        comps.forEach(c => { compMap[String(c.id || c.ID)] = c.Title || c.Titulo || '—' })
        const cliMap = {}
        clis.forEach(c => { cliMap[String(c.id || c.ID)] = c.Title || c.Titulo || '—' })

        setHitos(h)
        setCompanias(compMap)
        setClientes(cliMap)
      } catch (e) {
        console.error('Error cargando facturación:', e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [proyectoId])

  // ── KPIs ──
  const totalMonto = hitos.reduce((s, h) => s + (h.Monto || 0), 0)
  const facturado = hitos.filter(h => ['Invoiced', 'Paid', 'Payment confirmed', 'Overdue payment'].includes(h.Status))
    .reduce((s, h) => s + (h.Monto || 0), 0)
  const pagado = hitos.filter(h => ['Paid', 'Payment confirmed'].includes(h.Status))
    .reduce((s, h) => s + (h.Monto || 0), 0)
  const pendiente = hitos.filter(h => !['Invoiced', 'Paid', 'Payment confirmed', 'Overdue payment', 'Overdue invoice'].includes(h.Status))
    .reduce((s, h) => s + (h.Monto || 0), 0)
  const vencido = hitos.filter(h => ['Overdue invoice', 'Overdue payment'].includes(h.Status))
    .reduce((s, h) => s + (h.Monto || 0), 0)

  // Moneda dominante para KPIs (la más frecuente)
  const currencies = hitos.map(h => h.Currency).filter(Boolean)
  const monedaPpal = currencies.sort((a, b) =>
    currencies.filter(v => v === b).length - currencies.filter(v => v === a).length
  )[0] || 'USD'

  // ── Filtros ──
  const statusOpciones = ['todos', ...Object.keys(STATUS_CONFIG)]
  const hitosFiltrados = filtroStatus === 'todos'
    ? hitos
    : hitos.filter(h => h.Status === filtroStatus)

  const hitosSorted = [...hitosFiltrados].sort((a, b) => {
    if (!a.Fecha_Factura && !b.Fecha_Factura) return 0
    if (!a.Fecha_Factura) return 1
    if (!b.Fecha_Factura) return -1
    return dayjs(a.Fecha_Factura).valueOf() - dayjs(b.Fecha_Factura).valueOf()
  })

  if (loading) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: C.faint, fontSize: '12px', fontFamily: C.mono }}>
      Cargando facturación...
    </div>
  )

  return (
    <div>
      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))', gap: '9px', marginBottom: '18px' }}>
        <KpiCard label="Total contrato" valor={formatMonto(totalMonto, monedaPpal)} sub={`${hitos.length} hitos`} color={C.navy} />
        <KpiCard label="Facturado" valor={formatMonto(facturado, monedaPpal)} sub={`${hitos.filter(h => ['Invoiced','Paid','Payment confirmed','Overdue payment'].includes(h.Status)).length} hitos`} color={C.blue} />
        <KpiCard label="Cobrado" valor={formatMonto(pagado, monedaPpal)} sub={`${hitos.filter(h => ['Paid','Payment confirmed'].includes(h.Status)).length} hitos`} color={C.green} />
        <KpiCard label="Pendiente" valor={formatMonto(pendiente, monedaPpal)} sub="sin facturar" color={C.muted} />
        <KpiCard label="Vencido" valor={formatMonto(vencido, monedaPpal)} sub="requiere atención" color={vencido > 0 ? C.red : C.faint} />
      </div>

      {/* ── Barra progreso cobro ── */}
      {totalMonto > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '14px 16px', marginBottom: '18px', boxShadow: '0 1px 3px rgba(30,42,58,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted }}>
              Progreso de cobro
            </span>
            <span style={{ fontSize: '11px', fontFamily: C.mono, fontWeight: 700, color: C.navy }}>
              {Math.round((pagado / totalMonto) * 100)}%
            </span>
          </div>
          <div style={{ height: '8px', background: C.bg, borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
            {pagado > 0 && (
              <div style={{ width: `${(pagado / totalMonto) * 100}%`, background: C.greenAccent, borderRadius: '4px 0 0 4px', transition: 'width .4s' }} />
            )}
            {(facturado - pagado) > 0 && (
              <div style={{ width: `${((facturado - pagado) / totalMonto) * 100}%`, background: C.blueAccent }} />
            )}
            {vencido > 0 && (
              <div style={{ width: `${(vencido / totalMonto) * 100}%`, background: C.redAccent }} />
            )}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '10px', color: C.muted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: C.greenAccent, display: 'inline-block' }} />Cobrado
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: C.blueAccent, display: 'inline-block' }} />Facturado
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: C.redAccent, display: 'inline-block' }} />Vencido
            </span>
          </div>
        </div>
      )}

      {/* ── Sección tabla ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: `1px solid ${C.border}`, marginBottom: '12px' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted }}>
          Hitos de facturación
        </span>

        {/* Filtro status */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {statusOpciones.map(s => {
            const cfg = STATUS_CONFIG[s]
            const activo = filtroStatus === s
            return (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                style={{
                  padding: '2px 9px', borderRadius: '9px', border: `1px solid ${activo ? (cfg?.border || C.blueAccent) : C.border}`,
                  background: activo ? (cfg?.bg || C.blueLight) : 'transparent',
                  color: activo ? (cfg?.color || C.blue) : C.muted,
                  fontSize: '9px', fontWeight: 700, fontFamily: C.mono,
                  cursor: 'pointer', transition: 'all .12s'
                }}
              >
                {s === 'todos' ? 'Todos' : (cfg?.label || s)}
                {s !== 'todos' && (
                  <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                    ({hitos.filter(h => h.Status === s).length})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tabla hitos ── */}
      <div style={{
        overflowX: 'auto', borderRadius: '8px',
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.05)',
        background: C.surface,
      }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '11.5px', width: '100%' }}>
          <thead>
            <tr style={{ background: C.navy }}>
              {['Hito', 'Compañía / Cliente', 'Monto', 'Fecha FC', 'Fecha Pago', 'Invoice', 'Estado', 'Comentarios'].map(h => (
                <th key={h} style={{
                  padding: '7px 9px', textAlign: 'left',
                  fontSize: '8.5px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.08em',
                  color: 'rgba(255,255,255,.75)', whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hitosSorted.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: C.faint, fontFamily: C.mono, fontSize: '12px' }}>
                  No hay hitos para este proyecto.
                </td>
              </tr>
            ) : (
              hitosSorted.map((hito, idx) => {
                const estaVencido = ['Overdue invoice', 'Overdue payment'].includes(hito.Status)
                const nombreComp = companias[String(hito.ID_Compa_x00f1_ia)] || '—'
                const nombreCli = clientes[String(hito.ID_Cliente)] || null

                return (
                  <tr
                    key={hito.id || idx}
                    style={{ background: estaVencido ? '#fffaf8' : idx % 2 === 0 ? C.surface : C.bg }}
                  >
                    {/* Hito */}
                    <td style={{ ...tdBase, fontFamily: C.sans, fontWeight: 600, color: C.text, maxWidth: '200px' }}>
                      <div style={{ fontWeight: 600, color: C.text }}>{hito.Title || '—'}</div>
                      {hito.Date_Invoice_Requested && (
                        <div style={{ fontSize: '9.5px', color: C.faint, fontFamily: C.mono, marginTop: '2px' }}>
                          Solicitado: {formatFecha(hito.Date_Invoice_Requested)}
                        </div>
                      )}
                    </td>

                    {/* Compañía / Cliente */}
                    <td style={tdBase}>
                      <div style={{ fontFamily: C.sans, fontSize: '11px', color: C.text }}>{nombreComp}</div>
                      {nombreCli && (
                        <div style={{ fontSize: '9.5px', color: C.muted, marginTop: '1px' }}>
                          Cliente: {nombreCli}
                        </div>
                      )}
                    </td>

                    {/* Monto */}
                    <td style={{ ...tdBase, fontFamily: C.mono, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>
                      {formatMonto(hito.Monto, hito.Currency)}
                      {hito.Currency && (
                        <span style={{ fontSize: '9px', color: C.faint, marginLeft: '4px' }}>{hito.Currency}</span>
                      )}
                    </td>

                    {/* Fecha Factura */}
                    <td style={{ ...tdBase, fontFamily: C.mono, fontSize: '11px', whiteSpace: 'nowrap', color: C.muted }}>
                      {formatFecha(hito.Fecha_Factura)}
                    </td>

                    {/* Fecha Pago */}
                    <td style={{ ...tdBase, fontFamily: C.mono, fontSize: '11px', whiteSpace: 'nowrap', color: C.muted }}>
                      {formatFecha(hito.Fecha_Pago)}
                    </td>

                    {/* Invoice */}
                    <td style={{ ...tdBase, fontFamily: C.mono, fontSize: '10px', color: C.blue }}>
                      {hito.Invoice || '—'}
                    </td>

                    {/* Estado */}
                    <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                      <StatusBadge status={hito.Status} />
                    </td>

                    {/* Comentarios */}
                    <td style={{ ...tdBase, color: C.muted, fontSize: '11px', maxWidth: '180px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}
                        title={hito.Comentarios}>
                        {hito.Comentarios || '—'}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Leyenda estados ── */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: C.muted }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const tdBase = {
  padding: '7px 9px',
  borderTop: `1px solid #dde2ea`,
  verticalAlign: 'middle',
}
