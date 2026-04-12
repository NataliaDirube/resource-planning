// ============================================
// Asignaciones.jsx — Estética GoSCM + bug duplicado corregido
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'
import {
  getAsignacionesByProyecto,
  getNominaActiva,
  getAsignacionesConsultorSemana,
  getTodasAsignacionesHardConsultor,
  crearAsignacion,
  actualizarAsignacion,
  eliminarAsignacion
} from '../services/graphService'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import isoWeek from 'dayjs/plugin/isoWeek'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
dayjs.extend(utc)
dayjs.extend(isoWeek)
dayjs.extend(isSameOrAfter)

const ORDEN_TIPOS = ['Hard', 'Soft', 'C 85%', 'C 50%', 'Lost', 'Commercial']
const TIPOS = ['Hard', 'Soft', 'C 85%', 'C 50%', 'Lost', 'Commercial']

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
  mono: "'DM Mono', 'Courier New', monospace",
  sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

function getSemanas(asignaciones) {
  const hoy = dayjs().startOf('isoWeek')
  if (!asignaciones || asignaciones.length === 0) {
    return Array.from({ length: 8 }, (_, i) => hoy.add(i, 'week'))
  }
  const ultima = asignaciones
    .map(a => dayjs.utc(a.Semana).startOf('isoWeek'))
    .sort((a, b) => b.valueOf() - a.valueOf())[0]
  const fin = ultima.isAfter(hoy) ? ultima : hoy.add(4, 'week')
  const semanas = []
  let cursor = hoy
  while (cursor.isBefore(fin) || cursor.isSame(fin, 'week')) {
    semanas.push(cursor)
    cursor = cursor.add(1, 'week')
  }
  return semanas
}

function puedeEditar(semana, role) {
  if (role === 'admin') return true
  if (role === 'rm') return dayjs(semana).isSameOrAfter(dayjs().startOf('isoWeek'))
  if (role === 'rl') return dayjs(semana).isSameOrAfter(dayjs().startOf('isoWeek').add(3, 'week'))
  return false
}

function getNombreConsultor(fields) {
  const nombre = fields.Consultor || fields.field_0 || '—'
  const esTBD = nombre.toLowerCase().includes('tbd')
  const detalle = fields.Title || ''
  if (esTBD && detalle) return `${nombre} (${detalle})`
  return nombre
}

function formatPct(valor) {
  if (valor === null || valor === undefined) return null
  const num = valor <= 1 ? valor * 100 : valor
  return `${Math.round(num)}%`
}

function colorAsignacion(tipo) {
  if (tipo === 'Hard') return { bg: C.greenLight, color: C.green, border: C.greenAccent }
  if (tipo === 'Lost') return { bg: C.redLight, color: C.red, border: C.redAccent }
  return { bg: C.orangeLight, color: C.orange, border: C.orangeAccent }
}

function colorDisp(libre) {
  if (libre >= 50) return { bg: C.greenLight, color: C.green, border: C.greenAccent }
  if (libre >= 20) return { bg: C.orangeLight, color: C.orange, border: C.orangeAccent }
  return { bg: C.redLight, color: C.red, border: C.redAccent }
}

function validarLunes(fechaStr) {
  if (!fechaStr) return null
  const d = dayjs(fechaStr)
  if (d.isoWeekday() !== 1) return d.startOf('isoWeek')
  return d
}

// ── Badge de tipo ──
function TipoBadge({ tipo }) {
  const col = colorAsignacion(tipo)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: '9px',
      fontSize: '9px', fontWeight: 700,
      fontFamily: C.mono,
      background: col.bg, color: col.color,
    }}>
      {tipo}
    </span>
  )
}

// ============================================
// COMPONENTE: Dropdown con búsqueda
// ============================================
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const filtradas = options.filter(o => o.label.toLowerCase().includes(busqueda.toLowerCase()))
  const seleccionado = options.find(o => String(o.value) === String(value))

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={fm.input}
        placeholder={placeholder}
        value={abierto ? busqueda : (seleccionado?.label || '')}
        onFocus={() => { setAbierto(true); setBusqueda('') }}
        onChange={e => { setBusqueda(e.target.value); setAbierto(true) }}
      />
      {abierto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: '7px',
          boxShadow: '0 4px 16px rgba(30,42,58,0.12)', zIndex: 200,
          maxHeight: '220px', overflowY: 'auto', marginTop: '2px'
        }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: '12px', color: C.faint }}>Sin resultados</div>
          ) : (
            filtradas.map((o, i) => (
              <div key={o.value} style={{
                padding: '8px 14px', fontSize: '12px', cursor: 'pointer',
                background: String(o.value) === String(value) ? C.blueLight : i % 2 === 0 ? C.surface : C.bg,
                color: o.esTBD ? C.orange : C.text,
                borderTop: o.esTBD && !filtradas[i - 1]?.esTBD ? `1px solid ${C.border}` : 'none',
                fontFamily: C.sans
              }}
                onMouseDown={() => { onChange(o.value); setAbierto(false); setBusqueda('') }}
              >
                {o.label}
                {o.esTBD && <span style={{ fontSize: '9px', color: C.faint, marginLeft: '6px', fontFamily: C.mono }}>TBD</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// MODAL: agregar consultor nuevo al proyecto
// ============================================
function ModalNuevoConsultor({ proyecto, nomina, instance, accounts, onGuardar, onCerrar }) {
  const [consultorId, setConsultorId] = useState('')
  const [tipo, setTipo] = useState('Hard')
  const [fechaInput, setFechaInput] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [advertencia, setAdvertencia] = useState('')
  const [disponibilidad, setDisponibilidad] = useState(null)
  const [cargandoDisp, setCargandoDisp] = useState(false)

  const hoyLunes = dayjs().startOf('isoWeek').format('YYYY-MM-DD')
  const consultorSeleccionado = nomina.find(n => String(n.id) === String(consultorId))
  const nombreConsultor = consultorSeleccionado?.field_0 || consultorSeleccionado?.Empleado || ''
  const esTBD = nombreConsultor.toLowerCase().includes('tbd')
  const semanaValida = fechaInput ? validarLunes(fechaInput) : null

  const opcionesConsultor = nomina.map(n => ({
    value: n.id,
    label: n.field_0 || n.Empleado || '—',
    esTBD: (n.field_11 || '').toLowerCase().includes('tbd')
  }))

  useEffect(() => {
    if (!consultorId || !semanaValida || tipo !== 'Hard' || esTBD) { setDisponibilidad(null); return }
    async function calcular() {
      setCargandoDisp(true)
      try {
        const lookupId = consultorSeleccionado?.EmpleadoLookupId || consultorSeleccionado?.id
        if (!lookupId) { setDisponibilidad(null); return }
        const asigs = await getAsignacionesConsultorSemana(instance, accounts, loginRequest, lookupId, semanaValida)
        const total = asigs.reduce((sum, a) => {
          const val = a.Asignacion <= 1 ? a.Asignacion * 100 : a.Asignacion
          return sum + val
        }, 0)
        setDisponibilidad({ totalAsignado: Math.round(total), libre: Math.max(0, 100 - Math.round(total)) })
      } catch (e) {
        console.error(e)
      } finally {
        setCargandoDisp(false)
      }
    }
    calcular()
  }, [consultorId, tipo, fechaInput])

  useEffect(() => {
    if (!disponibilidad || tipo !== 'Hard' || !porcentaje) { setAdvertencia(''); return }
    if (parseFloat(porcentaje) > disponibilidad.libre) {
      setAdvertencia(`Este consultor tiene ${disponibilidad.libre}% libre en Hard esa semana. Podés guardar igual.`)
    } else {
      setAdvertencia('')
    }
  }, [porcentaje, disponibilidad])

  async function handleSubmit() {
    if (!consultorId) { setError('Seleccioná un consultor'); return }
    if (!semanaValida) { setError('Seleccioná una fecha de inicio'); return }
    if (semanaValida.isBefore(dayjs().startOf('isoWeek'))) { setError('La semana no puede ser anterior a la semana actual'); return }
    if (!porcentaje) { setError('Ingresá un porcentaje'); return }
    const pct = parseFloat(porcentaje)
    if (pct <= 0 || pct > 100) { setError('El porcentaje debe ser entre 1 y 100'); return }
    setGuardando(true)
    setError('')
    await onGuardar({ consultorNomina: consultorSeleccionado, tipo, semana: semanaValida, porcentaje: pct, detalle: esTBD ? detalle : '' })
    setGuardando(false)
  }

  return (
    <div style={overlay} onClick={onCerrar}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        {/* Header modal */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.navy }}>Agregar consultor</div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px', fontFamily: C.mono }}>
              {proyecto.field_1 || proyecto.Title}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: C.faint, lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        <div style={fm.grupo}>
          <label style={fm.label}>Consultor</label>
          <SearchableSelect options={opcionesConsultor} value={consultorId} onChange={v => { setConsultorId(v); setError('') }} placeholder='Buscá un consultor...' />
        </div>

        {esTBD && (
          <div style={fm.grupo}>
            <label style={fm.label}>Detalle TBD</label>
            <input style={fm.input} placeholder='Ej: TBD Senior Java' value={detalle} onChange={e => setDetalle(e.target.value)} />
          </div>
        )}

        <div style={fm.grupo}>
          <label style={fm.label}>Tipo de asignación</label>
          <select style={fm.select} value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={fm.grupo}>
          <label style={fm.label}>Semana de inicio</label>
          <input style={fm.input} type='date' min={hoyLunes} value={fechaInput}
            onChange={e => {
              const val = e.target.value
              setFechaInput(val)
              setError('')
              if (val && dayjs(val).isoWeekday() !== 1)
                setError(`No es lunes. Se usará el lunes ${dayjs(val).startOf('isoWeek').format('DD-MMM-YYYY')}.`)
            }}
          />
          {semanaValida && (
            <div style={{ fontSize: '11px', color: C.blue, marginTop: '4px', fontFamily: C.mono }}>
              Semana: lunes {semanaValida.format('DD-MMM-YYYY')}
            </div>
          )}
        </div>

        {consultorId && semanaValida && tipo === 'Hard' && (
          <div style={{ marginBottom: '16px' }}>
            {cargandoDisp ? (
              <div style={{ fontSize: '12px', color: C.faint, padding: '8px 12px', background: C.bg, borderRadius: '7px', fontFamily: C.mono }}>
                Calculando disponibilidad...
              </div>
            ) : disponibilidad !== null ? (
              <div style={{
                fontSize: '12px', padding: '10px 14px', borderRadius: '7px',
                background: colorDisp(disponibilidad.libre).bg,
                border: `1px solid ${colorDisp(disponibilidad.libre).border}22`,
                color: colorDisp(disponibilidad.libre).color
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Disponibilidad {semanaValida.format('DD-MMM')}</span>
                  <span style={{ fontWeight: 700, fontFamily: C.mono }}>{disponibilidad.libre}% libre</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '4px', width: `${disponibilidad.totalAsignado}%`, background: colorDisp(disponibilidad.libre).color }} />
                </div>
                <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8, fontFamily: C.mono }}>
                  {disponibilidad.totalAsignado}% asignado en Hard en otros proyectos
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div style={fm.grupo}>
          <label style={fm.label}>Porcentaje</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input style={{ ...fm.input, width: '80px' }} type='number' min='1' max='100' placeholder='100'
              value={porcentaje} onChange={e => { setPorcentaje(e.target.value); setError('') }} />
            <span style={{ fontSize: '13px', color: C.muted }}>%</span>
            {disponibilidad !== null && tipo === 'Hard' && (
              <span style={{ fontSize: '11px', color: C.faint, fontFamily: C.mono }}>
                (máx sugerido: {disponibilidad.libre}%)
              </span>
            )}
          </div>
        </div>

        {advertencia && (
          <div style={{ fontSize: '12px', color: C.orange, marginBottom: '12px', background: C.orangeLight, padding: '10px 12px', borderRadius: '6px', border: `1px solid ${C.orangeAccent}`, lineHeight: '1.5' }}>
            {advertencia}
          </div>
        )}
        {error && (
          <div style={{ fontSize: '12px', color: C.red, marginBottom: '12px', background: C.redLight, padding: '8px 12px', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button onClick={onCerrar} style={bts.sec}>Cancelar</button>
          <button onClick={handleSubmit} disabled={guardando} style={{ ...bts.pri, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function Asignaciones({ role, roleId, proyecto }) {
  const { instance, accounts } = useMsal()
  const [asignaciones, setAsignaciones] = useState([])
  const [nomina, setNomina] = useState([])
  const [loading, setLoading] = useState(true)
  const [filaEditando, setFilaEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorFila, setErrorFila] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [disponibilidadFila, setDisponibilidadFila] = useState({})

  const primeraInputRef = useRef(null)
  const valoresEditadosRef = useRef({})
  // ── FIX DUPLICADO: flag para evitar que Enter dispare guardarFila múltiples veces ──
  const guardandoRef = useRef(false)

  const proyectoId = proyecto.id || proyecto.ID

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true)
      try {
        const [a, n] = await Promise.all([
          getAsignacionesByProyecto(instance, accounts, loginRequest, proyectoId),
          getNominaActiva(instance, accounts, loginRequest)
        ])
        setAsignaciones(a)
        setNomina(n)
      } catch (e) {
        console.error('Error cargando datos:', e)
      } finally {
        setLoading(false)
      }
    }
    cargarDatos()
  }, [proyectoId])

  const semanas = getSemanas(asignaciones)

  useEffect(() => {
    if (filaEditando && primeraInputRef.current) {
      primeraInputRef.current.focus({ preventScroll: true })
    }
  }, [filaEditando])

  useEffect(() => {
    valoresEditadosRef.current = {}
    guardandoRef.current = false  // reset al cambiar de fila
  }, [filaEditando])

  const filasMap = {}
  asignaciones.forEach(a => {
    const consultorId = a.ConsultorLookupId
    const tipo = a.Tipo_Asignacion
    const key = `${consultorId}-${tipo}`
    if (!filasMap[key]) {
      filasMap[key] = {
        consultorId, consultorNombre: getNombreConsultor(a),
        tipo, ordenTipo: ORDEN_TIPOS.indexOf(tipo) ?? 99
      }
    }
  })

  const filas = Object.values(filasMap).sort((a, b) => {
    if (a.ordenTipo !== b.ordenTipo) return a.ordenTipo - b.ordenTipo
    return a.consultorNombre.localeCompare(b.consultorNombre)
  })

  function getAsignacion(consultorId, tipo, semana) {
    return asignaciones.find(a => {
      const semanaAsig = dayjs.utc(a.Semana).startOf('isoWeek').format('YYYY-MM-DD')
      const semanaCol = semana.startOf('isoWeek').format('YYYY-MM-DD')
      return a.ConsultorLookupId === consultorId && a.Tipo_Asignacion === tipo && semanaAsig === semanaCol
    })
  }

  async function calcularDisponibilidadFila(consultorId) {
    try {
      const todasHard = await getTodasAsignacionesHardConsultor(instance, accounts, loginRequest, consultorId)
      const resultados = {}
      for (const sem of semanas) {
        const semanaISO = sem.startOf('isoWeek').format('YYYY-MM-DD')
        const totalOtros = todasHard
          .filter(a => dayjs.utc(a.Semana).startOf('isoWeek').format('YYYY-MM-DD') === semanaISO)
          .reduce((sum, a) => sum + (a.Asignacion <= 1 ? a.Asignacion * 100 : a.Asignacion), 0)
        resultados[semanaISO] = Math.max(0, 100 - Math.round(totalOtros))
      }
      setDisponibilidadFila(prev => ({ ...prev, [consultorId]: resultados }))
    } catch (e) {
      console.error('Error disponibilidad:', e)
    }
  }

  // ── FIX DUPLICADO: guardandoRef evita que Enter dispare esto más de una vez ──
  async function guardarFila(fila) {
    if (guardandoRef.current) return   // ← bloqueo: si ya está guardando, ignorar
    guardandoRef.current = true
    setErrorFila(null)

    const operaciones = []
    for (const sem of semanas) {
      const semanaISO = sem.startOf('isoWeek').format('YYYY-MM-DD')
      const rawValor = valoresEditadosRef.current[semanaISO]
      if (rawValor === undefined) continue
      const esVacio = rawValor === '' || rawValor === null
      const pct = esVacio ? 0 : parseFloat(rawValor)
      const existente = getAsignacion(fila.consultorId, fila.tipo, sem)

      if (esVacio || pct === 0) {
        if (existente) operaciones.push({ tipo: 'borrar', sem, semanaISO, existente })
      } else if (!isNaN(pct) && pct > 0 && pct <= 100) {
        operaciones.push({ tipo: existente ? 'actualizar' : 'crear', sem, semanaISO, existente, pct })
      }
    }

    if (operaciones.length === 0) {
      setFilaEditando(null)
      guardandoRef.current = false
      return
    }

    // Validación Hard
    if (fila.tipo === 'Hard') {
      const operHard = operaciones.filter(o => o.tipo !== 'borrar')
      if (operHard.length > 0) {
        const todasHard = await getTodasAsignacionesHardConsultor(instance, accounts, loginRequest, fila.consultorId)
        for (const op of operHard) {
          const totalOtros = todasHard
            .filter(a => {
              const semAsig = dayjs.utc(a.Semana).startOf('isoWeek').format('YYYY-MM-DD')
              return semAsig === op.semanaISO && String(a.ID_Proyecto) !== String(proyectoId)
            })
            .reduce((sum, a) => sum + (a.Asignacion <= 1 ? a.Asignacion * 100 : a.Asignacion), 0)

          if (totalOtros + op.pct > 100) {
            const disponible = Math.max(0, 100 - totalOtros)
            setErrorFila({ semanaKey: op.semanaISO, mensaje: `Supera 100% Hard. Disponible: ${Math.round(disponible)}%` })
            guardandoRef.current = false
            return
          }
        }
      }
    }

    setGuardando(true)
    try {
      await Promise.all(operaciones.map(async op => {
        if (op.tipo === 'borrar') {
          await eliminarAsignacion(instance, accounts, loginRequest, op.existente.id)
        } else if (op.tipo === 'actualizar') {
          await actualizarAsignacion(instance, accounts, loginRequest, op.existente.id, {
            Asignacion: op.pct / 100, Tipo_Asignacion: fila.tipo
          })
        } else {
          const refAsig = asignaciones.find(a => a.ConsultorLookupId === fila.consultorId)
          await crearAsignacion(instance, accounts, loginRequest, {
            ConsultorLookupId: parseInt(fila.consultorId),
            ID_consultor: refAsig?.ID_consultor ? parseInt(refAsig.ID_consultor) : undefined,
            ID_Proyecto: parseInt(proyectoId),
            Tipo_Asignacion: fila.tipo,
            Semana: op.sem.format('YYYY-MM-DD'),
            Asignacion: op.pct / 100
          })
        }
      }))
      const nuevas = await getAsignacionesByProyecto(instance, accounts, loginRequest, proyectoId)
      setAsignaciones(nuevas)
    } catch (e) {
      console.error('Error guardando fila:', e)
    } finally {
      setGuardando(false)
      setFilaEditando(null)
      valoresEditadosRef.current = {}
      guardandoRef.current = false
    }
  }

  async function handleNuevoConsultor({ consultorNomina, tipo, semana, porcentaje, detalle }) {
    try {
      const lookupId = consultorNomina.EmpleadoLookupId || consultorNomina.id
      const fields = {
        ConsultorLookupId: parseInt(lookupId),
        ID_consultor: parseInt(consultorNomina.id),
        ID_Proyecto: parseInt(proyectoId),
        Tipo_Asignacion: tipo,
        Semana: semana.format('YYYY-MM-DD'),
        Asignacion: porcentaje / 100,
        ...(detalle ? { Title: detalle } : {})
      }
      if (!lookupId || isNaN(parseInt(lookupId))) { console.error('TBD sin LookupId válido:', consultorNomina); return }
      await crearAsignacion(instance, accounts, loginRequest, fields)
      const nuevas = await getAsignacionesByProyecto(instance, accounts, loginRequest, proyectoId)
      setAsignaciones(nuevas)
      setModalNuevo(false)
    } catch (e) {
      console.error('Error creando consultor nuevo:', e)
    }
  }

  if (loading) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: C.faint, fontSize: '12px', fontFamily: C.mono }}>
      Cargando asignaciones de {proyecto.field_1 || proyecto.Title}...
    </div>
  )

  return (
    <div>
      {modalNuevo && (
        <ModalNuevoConsultor
          proyecto={proyecto} nomina={nomina}
          instance={instance} accounts={accounts}
          onGuardar={handleNuevoConsultor}
          onCerrar={() => setModalNuevo(false)}
        />
      )}

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))', gap: '9px', marginBottom: '18px' }}>
        <div style={kc}>
          <div style={kl}>Consultores</div>
          <div style={{ ...kv, color: C.navy }}>{filas.length}</div>
          <div style={ks}>en el proyecto</div>
        </div>
        <div style={kc}>
          <div style={kl}>Hard</div>
          <div style={{ ...kv, color: C.green }}>{filas.filter(f => f.tipo === 'Hard').length}</div>
          <div style={ks}>asignaciones</div>
        </div>
        <div style={kc}>
          <div style={kl}>Soft / otros</div>
          <div style={{ ...kv, color: C.orange }}>{filas.filter(f => f.tipo !== 'Hard' && f.tipo !== 'Lost').length}</div>
          <div style={ks}>asignaciones</div>
        </div>
        <div style={kc}>
          <div style={kl}>Semanas</div>
          <div style={{ ...kv, color: C.navy }}>{semanas.length}</div>
          <div style={ks}>en vista</div>
        </div>
      </div>

      {/* ── Sección tabla ── */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: `1px solid ${C.border}`, marginBottom: '12px' }}>
          <span style={secT}>Asignaciones por consultor</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {guardando && (
              <span style={{ fontSize: '11px', color: C.blue, fontFamily: C.mono }}>Guardando...</span>
            )}
            {(role === 'admin' || role === 'rm') && (
              <button
                onClick={() => setModalNuevo(true)}
                style={bts.pri}
                onMouseEnter={e => e.currentTarget.style.background = C.navy}
                onMouseLeave={e => e.currentTarget.style.background = C.blue}
              >
                + Agregar consultor
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div style={{
        overflowX: 'auto',
        borderRadius: '8px',
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.05)',
        background: C.surface,
        maxWidth: '100%'
      }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '11.5px', tableLayout: 'auto', width: '100%' }}>
          <thead>
            <tr style={{ background: C.navy }}>
              <th style={th.fijo}>Consultor</th>
              <th style={th.tipo}>Tipo</th>
              {semanas.map(sem => {
                const editable = puedeEditar(sem, role)
                const esHoy = sem.isSame(dayjs().startOf('isoWeek'), 'week')
                return (
                  <th key={sem.format('YYYY-MM-DD')} style={th.semana(editable, esHoy)}>
                    {sem.format('DD/MM')}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={semanas.length + 2} style={{ padding: '40px', textAlign: 'center', color: C.faint, fontFamily: C.mono, fontSize: '12px' }}>
                  No hay asignaciones para este proyecto.
                </td>
              </tr>
            ) : (
              filas.map((fila, idx) => {
                const keyFila = `${fila.consultorId}-${fila.tipo}`
                const estaEditando = filaEditando === keyFila

                return (
                  <React.Fragment key={keyFila}>
                    <tr style={{ background: idx % 2 === 0 ? C.surface : C.bg }}>
                      {/* Columna consultor */}
                      <td style={td.fijo(idx % 2 === 0)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: C.sans, fontSize: '11.5px', fontWeight: 500 }}>
                            {fila.consultorNombre}
                          </span>
                          {estaEditando && (
                            <button
                              onClick={() => guardarFila(fila)}
                              disabled={guardando}
                              style={{ ...bts.pri, padding: '2px 10px', fontSize: '10px', opacity: guardando ? 0.6 : 1 }}
                            >
                              {guardando ? '...' : 'Guardar'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Tipo */}
                      <td style={{ padding: '6px 9px', borderTop: `1px solid ${C.border}` }}>
                        <TipoBadge tipo={fila.tipo} />
                      </td>

                      {/* Celdas de semana */}
                      {semanas.map((sem, semIdx) => {
                        const asig = getAsignacion(fila.consultorId, fila.tipo, sem)
                        const editable = puedeEditar(sem, role)
                        const esHoy = sem.isSame(dayjs().startOf('isoWeek'), 'week')
                        const semanaISO = sem.format('YYYY-MM-DD')
                        const col = colorAsignacion(fila.tipo)
                        const tieneError = errorFila?.semanaKey === semanaISO && estaEditando

                        return (
                          <td key={semanaISO} style={{
                            padding: '5px 4px',
                            borderTop: `1px solid ${C.border}`,
                            borderLeft: esHoy ? `2px solid ${C.orangeAccent}` : 'none',
                            textAlign: 'center',
                            background: esHoy ? '#FFFDF5' : 'transparent',
                            minWidth: '58px',
                            position: 'relative'
                          }}>
                            {estaEditando ? (
                              <div style={{ position: 'relative' }}>
                                <input
                                  ref={semIdx === 0 ? primeraInputRef : null}
                                  defaultValue={asig ? Math.round(asig.Asignacion * 100) : ''}
                                  style={{
                                    width: '44px', padding: '3px 5px', fontSize: '11px',
                                    border: `1px solid ${tieneError ? C.redAccent : C.blueAccent}`,
                                    borderRadius: '3px', textAlign: 'center', outline: 'none',
                                    background: tieneError ? C.redLight : '#fff',
                                    fontFamily: C.mono
                                  }}
                                  onChange={e => {
                                    valoresEditadosRef.current[semanaISO] = e.target.value
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      // ── FIX DUPLICADO: capturar valor actual ANTES de guardar ──
                                      // y bloquear con guardandoRef para que solo se ejecute una vez
                                      e.preventDefault()
                                      valoresEditadosRef.current[semanaISO] = e.target.value
                                      guardarFila(fila)
                                    }
                                    if (e.key === 'Escape') {
                                      setFilaEditando(null)
                                      setErrorFila(null)
                                      valoresEditadosRef.current = {}
                                      guardandoRef.current = false
                                    }
                                    if (e.key === 'Tab') {
                                      valoresEditadosRef.current[semanaISO] = e.target.value
                                    }
                                  }}
                                />
                                {tieneError && (
                                  <div style={{
                                    position: 'absolute', top: '100%', left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '9px', color: C.red,
                                    background: C.redLight, padding: '3px 8px',
                                    borderRadius: '4px', border: `1px solid ${C.redAccent}`,
                                    zIndex: 10, whiteSpace: 'nowrap', marginTop: '2px'
                                  }}>
                                    {errorFila.mensaje}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: asig ? '2px 5px' : '0',
                                  borderRadius: '3px',
                                  background: asig ? col.bg : 'transparent',
                                  color: asig ? col.color : (editable ? C.border2 : 'transparent'),
                                  fontFamily: C.mono,
                                  fontSize: asig ? '11px' : '16px',
                                  fontWeight: asig ? 700 : 400,
                                  cursor: editable ? 'pointer' : 'default',
                                  lineHeight: '1',
                                  transition: 'all .1s'
                                }}
                                onClick={() => {
                                  if (!editable) return
                                  setFilaEditando(keyFila)
                                  setErrorFila(null)
                                  calcularDisponibilidadFila(fila.consultorId)
                                }}
                              >
                                {asig ? formatPct(asig.Asignacion) : (editable ? '·' : '')}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>

                    {/* Fila disponibilidad */}
                    {estaEditando && (
                      <tr style={{ background: C.blueLight }}>
                        <td style={{
                          padding: '4px 9px', fontSize: '10px', color: C.blue, fontStyle: 'italic',
                          position: 'sticky', left: 0, background: C.blueLight, zIndex: 1,
                          minWidth: '180px', fontFamily: C.mono, borderTop: `1px solid ${C.border}`
                        }}>
                          % disponible
                        </td>
                        <td style={{ padding: '4px 8px', background: C.blueLight, borderTop: `1px solid ${C.border}` }} />
                        {semanas.map(sem => {
                          const semanaISO = sem.format('YYYY-MM-DD')
                          const disp = disponibilidadFila[fila.consultorId]?.[semanaISO]
                          const col = disp != null ? colorDisp(disp) : null
                          return (
                            <td key={semanaISO} style={{
                              padding: '4px 2px', textAlign: 'center',
                              fontSize: '10px', fontWeight: 600, fontFamily: C.mono,
                              color: col ? col.color : C.faint,
                              borderTop: `1px solid ${C.border}`
                            }}>
                              {disp != null ? `${disp}%` : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Leyenda ── */}
      <div style={{ display: 'flex', gap: '14px', marginTop: '14px', fontSize: '11px', color: C.muted, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { bg: C.greenLight, border: C.greenAccent, label: 'Hard' },
          { bg: C.orangeLight, border: C.orangeAccent, label: 'Soft / Otros' },
          { bg: C.redLight, border: C.redAccent, label: 'Lost' },
        ].map(({ bg, border, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '2px', background: bg, border: `1px solid ${border}`, display: 'inline-block' }} />
            {label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '11px', height: '11px', borderRadius: '2px', background: '#FFF9E6', border: `2px solid ${C.orangeAccent}`, display: 'inline-block' }} />
          Semana actual
        </span>
        <span style={{ color: C.blue, fontFamily: C.mono, fontSize: '10px' }}>
          Enter = guardar · Esc = cancelar
        </span>
      </div>
    </div>
  )
}

// ============================================
// ESTILOS
// ============================================
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox = {
  background: C.surface, borderRadius: '10px', padding: '28px',
  width: '440px', maxWidth: '90vw',
  boxShadow: '0 8px 32px rgba(30,42,58,0.18)',
  border: `1px solid ${C.border}`
}
const fm = {
  grupo: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted, marginBottom: '5px' },
  select: { width: '100%', padding: '8px 10px', fontSize: '12px', border: `1px solid ${C.border}`, borderRadius: '6px', outline: 'none', background: C.surface, boxSizing: 'border-box', color: C.text, fontFamily: C.sans },
  input: { width: '100%', padding: '8px 10px', fontSize: '12px', border: `1px solid ${C.border}`, borderRadius: '6px', outline: 'none', boxSizing: 'border-box', color: C.text, fontFamily: C.sans }
}
const bts = {
  pri: { padding: '7px 16px', background: C.blue, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: C.sans, transition: 'background .13s' },
  sec: { padding: '7px 14px', background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: C.sans }
}
const kc = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px 14px', boxShadow: '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.05)' }
const kl = { fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted }
const kv = { fontSize: '22px', fontWeight: 700, fontFamily: C.mono, marginTop: '3px' }
const ks = { fontSize: '9.5px', color: C.faint, marginTop: '1px', fontFamily: C.mono }
const secT = { fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted }
const th = {
  fijo: {
    padding: '7px 9px', textAlign: 'left', fontSize: '8.5px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.75)',
    whiteSpace: 'nowrap', minWidth: '180px', position: 'sticky', left: 0,
    background: C.navy, zIndex: 2
  },
  tipo: {
    padding: '7px 9px', textAlign: 'left', fontSize: '8.5px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.75)',
    whiteSpace: 'nowrap', minWidth: '70px'
  },
  semana: (editable, esHoy) => ({
    padding: '7px 6px', textAlign: 'center', fontSize: '8px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.05em',
    color: esHoy ? C.orangeAccent : editable ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)',
    background: esHoy ? 'rgba(215,119,6,0.15)' : C.navy,
    borderLeft: esHoy ? `2px solid ${C.orangeAccent}` : 'none',
    whiteSpace: 'nowrap', minWidth: '52px'
  })
}
const td = {
  fijo: (par) => ({
    padding: '6px 9px', borderTop: `1px solid ${C.border}`,
    whiteSpace: 'nowrap', fontWeight: 500,
    position: 'sticky', left: 0,
    background: par ? C.surface : C.bg, zIndex: 1
  }),
}
