// Inicio.jsx — Rediseñado con la estética de GoSCM Staffing Planner

import { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'
import { getProyectos } from '../services/graphService'

const DIEGO_URL = 'https://goscm-staffing-planner-production.up.railway.app/index_34.html'

// Colores por estado del proyecto
function colorEstado(estado) {
  if (!estado) return { bg: '#f0f3f7', color: '#6b7c93', border: '#dde2ea' }
  const e = estado.toLowerCase()
  if (e === 'active') return { bg: '#e6f4ed', color: '#1a6640', border: '#2e9e63' }
  if (e === 'opportunity') return { bg: '#fff3e0', color: '#8a4a00', border: '#d97706' }
  if (e === 'ccss') return { bg: '#e8eef8', color: '#1a3a6e', border: '#3b72d9' }
  return { bg: '#f0f3f7', color: '#6b7c93', border: '#dde2ea' }
}

export default function Inicio({ role, roleId, onSeleccionarProyecto }) {
  const { instance, accounts } = useMsal()
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function cargar() {
      try {
        const todos = await getProyectos(instance, accounts, loginRequest)

        if (role === 'admin') {
          setProyectos(todos)
        } else if (role === 'rl') {
          setProyectos(todos.filter(p => p.ID_RL === roleId))
        } else if (role === 'rm') {
          setProyectos(todos.filter(p => p.ID_RM === roleId))
        }
      } catch (e) {
        console.error('Error cargando proyectos:', e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [role, roleId])

  const visibles = proyectos.filter(p =>
    p.field_1?.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return (
    <div style={{
      padding: '60px 0', textAlign: 'center',
      color: '#9eaabb', fontSize: '12px',
      fontFamily: "'DM Mono', 'Courier New', monospace"
    }}>
      Cargando proyectos...
    </div>
  )

  return (
    <div>
      {/* KPI row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))',
        gap: '9px',
        marginBottom: '18px'
      }}>
        <div style={kc}>
          <div style={kl}>Total proyectos</div>
          <div style={{ ...kv, color: '#1a3a6e' }}>{proyectos.length}</div>
          <div style={ks}>en tu vista</div>
        </div>
        <div style={kc}>
          <div style={kl}>Activos</div>
          <div style={{ ...kv, color: '#2e9e63' }}>
            {proyectos.filter(p => p.field_10?.toLowerCase() === 'active').length}
          </div>
          <div style={ks}>Active</div>
        </div>
        <div style={kc}>
          <div style={kl}>Oportunidades</div>
          <div style={{ ...kv, color: '#d97706' }}>
            {proyectos.filter(p => p.field_10?.toLowerCase() === 'opportunity').length}
          </div>
          <div style={ks}>Opportunity</div>
        </div>
        <div style={kc}>
          <div style={kl}>CCSS</div>
          <div style={{ ...kv, color: '#3b72d9' }}>
            {proyectos.filter(p => p.field_10?.toLowerCase() === 'ccss').length}
          </div>
          <div style={ks}>CCSS</div>
        </div>
      </div>

      {/* Sección proyectos */}
      <div style={{ marginBottom: '18px' }}>
        <div style={secT}>Proyectos disponibles</div>

        {/* Buscador */}
        <div style={{ marginBottom: '14px', position: 'relative', maxWidth: '320px' }}>
          <span style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '11px', color: '#9eaabb', pointerEvents: 'none'
          }}>⌕</span>
          <input
            style={{
              width: '100%',
              padding: '7px 12px 7px 28px',
              fontSize: '12px',
              border: '1px solid #dde2ea',
              borderRadius: '7px',
              outline: 'none',
              background: '#fff',
              color: '#1e2a3a',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(30,42,58,.05)',
              transition: 'border-color .12s'
            }}
            placeholder="Buscar proyecto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onFocus={e => e.target.style.borderColor = '#3b72d9'}
            onBlur={e => e.target.style.borderColor = '#dde2ea'}
          />
        </div>

        {/* Grid de cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '10px'
        }}>
          {visibles.map(p => {
            const estado = p.field_10 || ''
            const col = colorEstado(estado)
            return (
              <div
                key={p.id}
                onClick={() => onSeleccionarProyecto(p)}
                style={{
                  background: '#fff',
                  border: '1px solid #dde2ea',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.04)',
                  transition: 'all .13s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3b72d9'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,42,58,.12), 0 6px 18px rgba(30,42,58,.07)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#dde2ea'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.04)'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                {/* ID + badge estado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '9px', color: '#9eaabb',
                    fontFamily: "'DM Mono', monospace", fontWeight: 500
                  }}>
                    #{p.id}
                  </span>
                  {estado && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '2px 6px', borderRadius: '9px',
                      fontSize: '9px', fontWeight: 700,
                      fontFamily: "'DM Mono', monospace",
                      background: col.bg, color: col.color,
                      border: `1px solid ${col.border}22`
                    }}>
                      {estado}
                    </span>
                  )}
                </div>

                {/* Nombre del proyecto */}
                <div style={{
                  fontSize: '13px', fontWeight: 600, color: '#1e2a3a',
                  lineHeight: 1.35
                }}>
                  {p.field_1 || p.Proyecto || '—'}
                </div>

                {/* CTA */}
                <div style={{
                  fontSize: '11px', color: '#2557a7', fontWeight: 500,
                  marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  Ver asignaciones
                  <span style={{ fontSize: '10px' }}>→</span>
                </div>
              </div>
            )
          })}

          {visibles.length === 0 && !loading && (
            <div style={{
              color: '#9eaabb', fontSize: '12px',
              gridColumn: '1/-1', padding: '24px 0',
              fontFamily: "'DM Mono', monospace"
            }}>
              No se encontraron proyectos.
            </div>
          )}
        </div>
      </div>

      {/* Botón volver al Staffing Planner — al final de la página */}
      <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #dde2ea' }}>
        <a
          href={DIEGO_URL}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px',
            background: '#fff', border: '1px solid #dde2ea',
            borderRadius: '7px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 500, color: '#6b7c93',
            boxShadow: '0 1px 3px rgba(30,42,58,.07)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            textDecoration: 'none',
            transition: 'all .13s'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#1a3a6e'; e.currentTarget.style.borderColor = '#3b72d9' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b7c93'; e.currentTarget.style.borderColor = '#dde2ea' }}
        >
          ← Volver al Staffing Planner
        </a>
      </div>
    </div>
  )

  // eslint-disable-next-line no-unreachable
  console.log('Campos del proyecto:', Object.keys(proyectos[0] || {}))
}

// ── Estilos compartidos ──
const kc = {
  background: '#fff',
  border: '1px solid #dde2ea',
  borderRadius: '8px',
  padding: '12px 14px',
  boxShadow: '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.05)'
}
const kl = {
  fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.08em',
  color: '#6b7c93'
}
const kv = {
  fontSize: '22px', fontWeight: 700,
  fontFamily: "'DM Mono', 'Courier New', monospace",
  marginTop: '3px'
}
const ks = {
  fontSize: '9.5px', color: '#9eaabb',
  marginTop: '1px', fontFamily: "'DM Mono', monospace"
}
const secT = {
  fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.1em',
  color: '#6b7c93', paddingBottom: '6px',
  borderBottom: '1px solid #dde2ea', marginBottom: '10px'
}
