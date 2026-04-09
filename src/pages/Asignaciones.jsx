// ============================================
// Asignaciones.jsx
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

function colorAsignacion(tipo, valor) {
  if (!valor && valor !== 0) return { bg: 'transparent', color: '#ccc' }
  if (tipo === 'Hard') return { bg: '#E1F5EE', color: '#0F6E56' }
  if (tipo === 'Lost') return { bg: '#FCEBEB', color: '#A32D2D' }
  return { bg: '#FAEEDA', color: '#854F0B' }
}

function colorDisp(libre) {
  if (libre >= 50) return { bg: '#E1F5EE', color: '#0F6E56', border: '#5DCAA5' }
  if (libre >= 20) return { bg: '#FAEEDA', color: '#854F0B', border: '#EF9F27' }
  return { bg: '#FCEBEB', color: '#A32D2D', border: '#F09595' }
}

function validarLunes(fechaStr) {
  if (!fechaStr) return null
  const d = dayjs(fechaStr)
  if (d.isoWeekday() !== 1) return d.startOf('isoWeek')
  return d
}

// ============================================
// COMPONENTE: Dropdown con búsqueda
// ============================================
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  const filtradas = options.filter(o =>
    o.label.toLowerCase().includes(busqueda.toLowerCase())
  )

  const seleccionado = options.find(o => String(o.value) === String(value))

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={{ ...fm.input, cursor: 'pointer', background: '#fff' }}
        placeholder={placeholder}
        value={abierto ? busqueda : (seleccionado?.label || '')}
        onFocus={() => { setAbierto(true); setBusqueda('') }}
        onChange={e => { setBusqueda(e.target.value); setAbierto(true) }}
      />
      {abierto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #ddd', borderRadius: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200,
          maxHeight: '220px', overflowY: 'auto', marginTop: '2px'
        }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: '13px', color: '#aaa' }}>
              Sin resultados
            </div>
          ) : (
            filtradas.map((o, i) => (
              <div
                key={o.value}
                style={{
                  padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
                  background: String(o.value) === String(value) ? '#EBF4FD' : i % 2 === 0 ? '#fff' : '#fafafa',
                  color: o.esTBD ? '#854F0B' : '#1a1a1a',
                  borderTop: o.esTBD && !filtradas[i - 1]?.esTBD ? '1px solid #eee' : 'none'
                }}
                onMouseDown={() => {
                  onChange(o.value)
                  setAbierto(false)
                  setBusqueda('')
                }}
              >
                {o.label}
                {o.esTBD && (
                  <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '6px' }}>TBD</span>
                )}
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
    // DESPUÉS
    if (!consultorId || !semanaValida || tipo !== 'Hard' || esTBD) { setDisponibilidad(null); return }
    async function calcular() {
      setCargandoDisp(true)
      try {
        // FIX: usamos EmpleadoLookupId con fallback a id
        const lookupId = consultorSeleccionado?.EmpleadoLookupId || consultorSeleccionado?.id
        if (!lookupId) { setDisponibilidad(null); return }
        const asigs = await getAsignacionesConsultorSemana(
          instance, accounts, loginRequest, lookupId, semanaValida
        )
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
    if (semanaValida.isBefore(dayjs().startOf('isoWeek'))) {
      setError('La semana no puede ser anterior a la semana actual'); return
    }
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
        <div style={mh.header}>
          <div>
            <div style={mh.titulo}>Agregar consultor al proyecto</div>
            <div style={mh.sub}>{proyecto.field_1 || proyecto.Title}</div>
          </div>
          <button onClick={onCerrar} style={mh.cerrar}>×</button>
        </div>

        <div style={fm.grupo}>
          <label style={fm.label}>Consultor</label>
          <SearchableSelect
            options={opcionesConsultor}
            value={consultorId}
            onChange={v => { setConsultorId(v); setError('') }}
            placeholder='Buscá un consultor...'
          />
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
          <input
            style={fm.input}
            type='date'
            min={hoyLunes}
            value={fechaInput}
            onChange={e => {
              const val = e.target.value
              setFechaInput(val)
              setError('')
              if (val && dayjs(val).isoWeekday() !== 1) {
                setError(`No es lunes. Se usará el lunes ${dayjs(val).startOf('isoWeek').format('DD-MMM-YYYY')}.`)
              }
            }}
          />
          {semanaValida && (
            <div style={{ fontSize: '11px', color: '#185FA5', marginTop: '4px' }}>
              Semana: lunes {semanaValida.format('DD-MMM-YYYY')}
            </div>
          )}
        </div>

        {consultorId && semanaValida && tipo === 'Hard' && (
          <div style={{ marginBottom: '16px' }}>
            {cargandoDisp ? (
              <div style={dispCargando}>Calculando disponibilidad...</div>
            ) : disponibilidad !== null ? (
              <div style={{ ...dispBox, background: colorDisp(disponibilidad.libre).bg, border: `1px solid ${colorDisp(disponibilidad.libre).border}`, color: colorDisp(disponibilidad.libre).color }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Disponibilidad {semanaValida.format('DD-MMM')}</span>
                  <span style={{ fontWeight: '500' }}>{disponibilidad.libre}% libre</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '4px', width: `${disponibilidad.totalAsignado}%`, background: colorDisp(disponibilidad.libre).color }} />
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                  {disponibilidad.totalAsignado}% asignado en Hard en otros proyectos
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div style={fm.grupo}>
          <label style={fm.label}>Porcentaje</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              style={{ ...fm.input, width: '80px', boxSizing: 'border-box' }}
              type='number' min='1' max='100' placeholder='100'
              value={porcentaje}
              onChange={e => { setPorcentaje(e.target.value); setError('') }}
            />
            <span style={{ fontSize: '13px', color: '#666' }}>%</span>
            {disponibilidad !== null && tipo === 'Hard' && (
              <span style={{ fontSize: '12px', color: '#888' }}>(máx sugerido: {disponibilidad.libre}%)</span>
            )}
          </div>
        </div>

        {advertencia && <div style={warn}>{advertencia}</div>}
        {error && <div style={errStyle}>{error}</div>}

        <div style={mh.btns}>
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
  const [filaEditando, setFilaEditando] = useState(null) // key "consultorId-tipo"
  const [guardando, setGuardando] = useState(false)
  const [errorFila, setErrorFila] = useState(null) // { semanaKey, mensaje }
  const [modalNuevo, setModalNuevo] = useState(false)
  const [disponibilidadFila, setDisponibilidadFila] = useState({}) // { consultorId: { 'YYYY-MM-DD': libre } }

  // FIX SCROLL: ref para enfocar sin mover la vista
  const primeraInputRef = useRef(null)
  // Guardamos los valores editados en memoria mientras la fila está activa
  const valoresEditadosRef = useRef({}) // { 'YYYY-MM-DD': string }

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

  // FIX SCROLL: cuando filaEditando cambia, enfocamos el primer input sin scroll
  useEffect(() => {
    if (filaEditando && primeraInputRef.current) {
      primeraInputRef.current.focus({ preventScroll: true })
    }
  }, [filaEditando])

  // Cuando se activa una fila nueva, limpiamos valores editados
  useEffect(() => {
    valoresEditadosRef.current = {}
  }, [filaEditando])

  const filasMap = {}
  asignaciones.forEach(a => {
    const consultorId = a.ConsultorLookupId
    const tipo = a.Tipo_Asignacion
    const key = `${consultorId}-${tipo}`
    if (!filasMap[key]) {
      filasMap[key] = {
        consultorId,
        consultorNombre: getNombreConsultor(a),
        tipo,
        ordenTipo: ORDEN_TIPOS.indexOf(tipo) ?? 99
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
      return (
        a.ConsultorLookupId === consultorId &&
        a.Tipo_Asignacion === tipo &&
        semanaAsig === semanaCol
      )
    })
  }

  // FIX PERFORMANCE: una sola llamada a la API, filtramos localmente por semana
  // Excluimos el proyecto actual para no contar doble la asignación que ya existe aquí
  async function calcularDisponibilidadFila(consultorId) {
    try {
      const todasHard = await getTodasAsignacionesHardConsultor(
        instance, accounts, loginRequest, consultorId
      )

      const resultados = {}
      for (const sem of semanas) {
        const semanaISO = sem.startOf('isoWeek').format('YYYY-MM-DD')
        const totalOtros = todasHard
          .filter(a => {
            const semAsig = dayjs.utc(a.Semana).startOf('isoWeek').format('YYYY-MM-DD')
            return semAsig === semanaISO  // ← incluye todos los proyectos
          })
          .reduce((sum, a) => {
            const val = a.Asignacion <= 1 ? a.Asignacion * 100 : a.Asignacion
            return sum + val
          }, 0)

        resultados[semanaISO] = Math.max(0, 100 - Math.round(totalOtros))
      }

      setDisponibilidadFila(prev => ({ ...prev, [consultorId]: resultados }))
    } catch (e) {
      console.error('Error disponibilidad:', e)
    }
  }

  // FIX GUARDAR FILA: guarda todas las celdas de la fila en paralelo
  // Lógica: vacío/0 → borrar si existe | >0 → crear o actualizar | >100% Hard → error
  async function guardarFila(fila) {
    setErrorFila(null)

    // Recolectamos todas las operaciones necesarias
    const operaciones = []

    for (const sem of semanas) {
      const semanaISO = sem.startOf('isoWeek').format('YYYY-MM-DD')
      const rawValor = valoresEditadosRef.current[semanaISO]

      // Si no tocamos esta celda, la saltamos
      if (rawValor === undefined) continue

      const esVacio = rawValor === '' || rawValor === null
      const pct = esVacio ? 0 : parseFloat(rawValor)
      const existente = getAsignacion(fila.consultorId, fila.tipo, sem)

      if (esVacio || pct === 0) {
        // Borrar si existe
        if (existente) {
          operaciones.push({ tipo: 'borrar', semana: sem, semanaISO, existente })
        }
      } else if (!isNaN(pct) && pct > 0 && pct <= 100) {
        operaciones.push({ tipo: existente ? 'actualizar' : 'crear', semana: sem, semanaISO, existente, pct })
      }
      // Si pct > 100 o NaN, lo ignoramos (el usuario verá que no se guardó)
    }

    if (operaciones.length === 0) {
      setFilaEditando(null)
      return
    }

    // Validación Hard: para las operaciones de crear/actualizar, verificamos disponibilidad
    if (fila.tipo === 'Hard') {
      const operHard = operaciones.filter(o => o.tipo !== 'borrar')
      if (operHard.length > 0) {
        // Una sola llamada para obtener todas las Hard del consultor
        const todasHard = await getTodasAsignacionesHardConsultor(
          instance, accounts, loginRequest, fila.consultorId
        )

        for (const op of operHard) {
          const semanaISO = op.semanaISO
          const totalOtros = todasHard
            .filter(a => {
              const semAsig = dayjs.utc(a.Semana).startOf('isoWeek').format('YYYY-MM-DD')
              return semAsig === semanaISO && String(a.ID_Proyecto) !== String(proyectoId)
            })
            .reduce((sum, a) => {
              const val = a.Asignacion <= 1 ? a.Asignacion * 100 : a.Asignacion
              return sum + val
            }, 0)

          if (totalOtros + op.pct > 100) {
            const disponible = Math.max(0, 100 - totalOtros)
            setErrorFila({
              semanaKey: semanaISO,
              mensaje: `Supera 100% Hard. Disponible: ${Math.round(disponible)}%`
            })
            return // No guardamos nada si alguna semana viola el límite
          }
        }
      }
    }

    setGuardando(true)

    try {
      // Ejecutamos todas las operaciones en paralelo
      await Promise.all(operaciones.map(async op => {
        if (op.tipo === 'borrar') {
          await eliminarAsignacion(instance, accounts, loginRequest, op.existente.id)
        } else if (op.tipo === 'actualizar') {
          await actualizarAsignacion(instance, accounts, loginRequest, op.existente.id, {
            Asignacion: op.pct / 100,
            Tipo_Asignacion: fila.tipo
          })
        } else {
          // crear
          const refAsig = asignaciones.find(a => a.ConsultorLookupId === fila.consultorId)
          await crearAsignacion(instance, accounts, loginRequest, {
            ConsultorLookupId: parseInt(fila.consultorId),
            ID_consultor: refAsig?.ID_consultor ? parseInt(refAsig.ID_consultor) : undefined,
            ID_Proyecto: parseInt(proyectoId),
            Tipo_Asignacion: fila.tipo,
            Semana: op.semana.format('YYYY-MM-DD'),
            Asignacion: op.pct / 100
          })
        }
      }))

      // Recargamos una sola vez después de todas las operaciones
      const nuevas = await getAsignacionesByProyecto(instance, accounts, loginRequest, proyectoId)
      setAsignaciones(nuevas)
    } catch (e) {
      console.error('Error guardando fila:', e)
    } finally {
      setGuardando(false)
      setFilaEditando(null)
      valoresEditadosRef.current = {}
    }
  }

  async function handleNuevoConsultor({ consultorNomina, tipo, semana, porcentaje, detalle }) {
    try {
      // FIX TBD: EmpleadoLookupId con fallback a id del list item
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
      if (!lookupId || isNaN(parseInt(lookupId))) {
        console.error('TBD sin LookupId válido:', consultorNomina)
        return
      }
      console.log('TBD fields a enviar:', JSON.stringify(fields, null, 2))
      console.log('consultorNomina completo:', JSON.stringify(consultorNomina, null, 2))
      await crearAsignacion(instance, accounts, loginRequest, fields)
      const nuevas = await getAsignacionesByProyecto(instance, accounts, loginRequest, proyectoId)
      setAsignaciones(nuevas)
      setModalNuevo(false)
    } catch (e) {
      console.error('Error creando consultor nuevo:', e)
    }
  }

  if (loading) return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#666' }}>
      Cargando asignaciones de {proyecto.field_1 || proyecto.Title}...
    </div>
  )

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>

      {modalNuevo && (
        <ModalNuevoConsultor
          proyecto={proyecto}
          nomina={nomina}
          instance={instance}
          accounts={accounts}
          onGuardar={handleNuevoConsultor}
          onCerrar={() => setModalNuevo(false)}
        />
      )}

      {/* Encabezado */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '500', color: '#1a1a1a' }}>
            {proyecto.field_1 || proyecto.Title}
          </h2>
          <span style={{ fontSize: '12px', color: '#aaa' }}>
            ID #{proyectoId} — {semanas.length} semanas · {filas.length} consultores
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {guardando && <span style={{ fontSize: '13px', color: '#185FA5' }}>Guardando...</span>}
          {(role === 'admin' || role === 'rm') && (
            <button onClick={() => setModalNuevo(true)} style={bts.pri}>
              + Agregar consultor
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e5e5', background: '#fff', maxWidth: '100%' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={th.fijo}>Consultor</th>
              <th style={th.tipo}>Tipo</th>
              {semanas.map(sem => (
                <th key={sem.format('YYYY-MM-DD')} style={th.semana(puedeEditar(sem, role), sem.isSame(dayjs().startOf('isoWeek'), 'week'))}>
                  {sem.format('DD-MMM')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={semanas.length + 2} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>
                  No hay asignaciones para este proyecto.
                </td>
              </tr>
            ) : (
              filas.map((fila, idx) => {
                const keyFila = `${fila.consultorId}-${fila.tipo}`
                const estaEditando = filaEditando === keyFila
                const esPrimeraFila = idx === 0

                return (
                  <React.Fragment key={keyFila}>
                    <tr style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {/* Columna consultor: si está editando muestra botón Guardar */}
                      <td style={td.fijo}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{fila.consultorNombre}</span>
                          {estaEditando && (
                            <button
                              onClick={() => guardarFila(fila)}
                              disabled={guardando}
                              style={{ ...bts.pri, padding: '3px 10px', fontSize: '11px', opacity: guardando ? 0.6 : 1 }}
                            >
                              {guardando ? '...' : 'Guardar'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={td.tipo(fila.tipo)}>{fila.tipo}</td>

                      {semanas.map((sem, semIdx) => {
                        const asig = getAsignacion(fila.consultorId, fila.tipo, sem)
                        const editable = puedeEditar(sem, role)
                        const esHoy = sem.isSame(dayjs().startOf('isoWeek'), 'week')
                        const semanaISO = sem.format('YYYY-MM-DD')
                        const { bg, color } = colorAsignacion(fila.tipo, asig?.Asignacion)
                        const tieneError = errorFila?.semanaKey === semanaISO && estaEditando

                        return (
                          <td key={semanaISO} style={td.celda(bg, editable, esHoy)}>
                            {estaEditando ? (
                              <div style={{ position: 'relative' }}>
                                <input
                                  // FIX SCROLL: solo ref en la primera celda editable, sin autoFocus
                                  ref={semIdx === 0 ? primeraInputRef : null}
                                  defaultValue={asig ? Math.round(asig.Asignacion * 100) : ''}
                                  style={{
                                    ...st.input,
                                    borderColor: tieneError ? '#E24B4A' : '#378ADD',
                                    background: tieneError ? '#FFF5F5' : '#fff'
                                  }}
                                  onChange={e => {
                                    // Guardamos el valor en memoria sin re-renderizar
                                    valoresEditadosRef.current[semanaISO] = e.target.value
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      // FIX: Enter guarda toda la fila
                                      guardarFila(fila)
                                    }
                                    if (e.key === 'Escape') {
                                      setFilaEditando(null)
                                      setErrorFila(null)
                                      valoresEditadosRef.current = {}
                                    }
                                    if (e.key === 'Tab') {
                                      // Tab normal entre inputs de la misma fila
                                      valoresEditadosRef.current[semanaISO] = e.target.value
                                    }
                                  }}
                                />
                                {tieneError && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%', left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '10px', color: '#A32D2D',
                                    background: '#FCEBEB', padding: '3px 8px',
                                    borderRadius: '4px', border: '1px solid #F09595',
                                    zIndex: 10, whiteSpace: 'nowrap', marginTop: '2px'
                                  }}>
                                    {errorFila.mensaje}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  color: asig ? color : (editable ? '#ccc' : 'transparent'),
                                  cursor: editable ? 'pointer' : 'default',
                                  display: 'block',
                                  textAlign: 'center',
                                  fontSize: asig ? '13px' : '18px',
                                  lineHeight: '1'
                                }}
                                onClick={async () => {
                                  if (!editable) return
                                  // FIX SCROLL: prevenimos cualquier scroll automático
                                  setFilaEditando(keyFila)
                                  setErrorFila(null)
                                  // Calculamos disponibilidad en background (no bloquea UI)
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

                    {/* Fila de disponibilidad — solo visible cuando la fila está en edición */}
                    {estaEditando && (
                      <tr style={{ background: '#F0F7FF' }}>
                        <td style={{
                          padding: '4px 16px', fontSize: '11px', color: '#185FA5', fontStyle: 'italic',
                          position: 'sticky', left: 0, background: '#F0F7FF', zIndex: 1,
                          minWidth: '180px'
                        }}>
                          % disponible
                        </td>
                        <td style={{
                          padding: '4px 8px', background: '#F0F7FF',
                          minWidth: '80px'
                        }} />
                        {semanas.map(sem => {
                          const semanaISO = sem.format('YYYY-MM-DD')
                          const disp = disponibilidadFila[fila.consultorId]?.[semanaISO]
                          const dispNum = disp ?? null
                          const col = dispNum !== null ? colorDisp(dispNum) : null

                          return (
                            <td key={semanaISO} style={{
                              padding: '4px 2px',
                              textAlign: 'center',
                              fontSize: '11px',
                              fontWeight: '500',
                              color: col ? col.color : '#bbb'
                            }}>
                              {dispNum !== null ? `${dispNum}%` : '—'}
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

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '12px', color: '#666', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#E1F5EE', border: '1px solid #5DCAA5', display: 'inline-block' }} />Hard
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#FAEEDA', border: '1px solid #EF9F27', display: 'inline-block' }} />Soft / Otros
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#FCEBEB', border: '1px solid #F09595', display: 'inline-block' }} />Lost
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E6F1FB', border: '1px solid #378ADD', display: 'inline-block' }} />Semanas editables
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#FFF9E6', border: '2px solid #EF9F27', display: 'inline-block' }} />Semana actual
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#185FA5' }}>
          Enter = guardar fila · Esc = cancelar
        </span>
      </div>
    </div>
  )
}

// ============================================
// ESTILOS
// ============================================
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox = { background: '#fff', borderRadius: '12px', padding: '28px', width: '420px', maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }
const mh = {
  header: { marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo: { fontSize: '16px', fontWeight: '500', color: '#1a1a1a' },
  sub: { fontSize: '12px', color: '#aaa', marginTop: '2px' },
  cerrar: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#aaa', lineHeight: 1 },
  btns: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }
}
const fm = {
  grupo: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' },
  select: { width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none', background: '#fff', boxSizing: 'border-box' },
  input: { width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }
}
const bts = {
  pri: { padding: '8px 20px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  sec: { padding: '8px 16px', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }
}
const warn = { fontSize: '12px', color: '#854F0B', marginBottom: '12px', background: '#FAEEDA', padding: '10px 12px', borderRadius: '6px', border: '1px solid #EF9F27', lineHeight: '1.5' }
const errStyle = { fontSize: '12px', color: '#A32D2D', marginBottom: '12px', background: '#FCEBEB', padding: '8px 12px', borderRadius: '6px' }
const dispCargando = { fontSize: '12px', color: '#aaa', padding: '8px 12px', background: '#f5f5f5', borderRadius: '6px' }
const dispBox = { fontSize: '13px', padding: '10px 14px', borderRadius: '8px' }
const th = {
  fijo: { padding: '10px 16px', textAlign: 'left', fontWeight: '500', borderBottom: '1px solid #e5e5e5', whiteSpace: 'nowrap', minWidth: '180px', position: 'sticky', left: 0, background: '#f5f5f5', zIndex: 2 },
  tipo: { padding: '10px 12px', textAlign: 'left', fontWeight: '500', borderBottom: '1px solid #e5e5e5', whiteSpace: 'nowrap', minWidth: '80px' },
  semana: (editable, esHoy) => ({
    padding: '10px 8px', textAlign: 'center', fontWeight: esHoy ? '600' : '500',
    borderBottom: '1px solid #e5e5e5', borderLeft: esHoy ? '2px solid #EF9F27' : 'none',
    whiteSpace: 'nowrap', minWidth: '64px', fontSize: '12px',
    color: esHoy ? '#854F0B' : editable ? '#185FA5' : '#999',
    background: esHoy ? '#FFF9E6' : editable ? '#EBF4FD' : '#f5f5f5'
  })
}
const td = {
  fijo: { padding: '8px 16px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', fontWeight: '500', position: 'sticky', left: 0, background: 'inherit', zIndex: 1 },
  tipo: (tipo) => ({ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: '500', color: tipo === 'Hard' ? '#0F6E56' : tipo === 'Lost' ? '#A32D2D' : '#854F0B' }),
  celda: (bg, editable, esHoy) => ({ padding: '6px 4px', borderBottom: '1px solid #f0f0f0', borderLeft: esHoy ? '2px solid #EF9F27' : 'none', textAlign: 'center', background: bg || (esHoy ? '#FFFDF5' : 'transparent'), minWidth: '64px', position: 'relative' })
}
const st = {
  input: { width: '48px', padding: '3px 6px', fontSize: '13px', border: '1px solid #378ADD', borderRadius: '4px', textAlign: 'center', outline: 'none' }
}
