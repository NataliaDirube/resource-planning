// App.jsx — Con navegación por secciones dentro del proyecto

import { useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest } from './authConfig'
import { useRole } from './hooks/useRole'
import Inicio from './pages/Inicio'
import Asignaciones from './pages/Asignaciones'
import Facturacion from './pages/Facturacion'

const DIEGO_URL = 'https://goscm-staffing-planner-production.up.railway.app/index_34.html'

const SECCIONES = [
  { id: 'asignaciones', label: 'Asignaciones', icon: '≡' },
  { id: 'facturacion',  label: 'Facturación',  icon: '◈' },
  // { id: 'viajes', label: 'Viajes', icon: '✈' },  // próximamente
]

function App() {
  const { instance, accounts } = useMsal()
  const isAuth = useIsAuthenticated()
  const { role, roleId, loading } = useRole(instance, accounts)
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null)
  const [seccionActiva, setSeccionActiva] = useState('asignaciones')

  const handleLogin = () => instance.loginRedirect(loginRequest)

  // Al seleccionar un proyecto, siempre arrancamos en Asignaciones
  function seleccionarProyecto(p) {
    setProyectoSeleccionado(p)
    setSeccionActiva('asignaciones')
  }

  function volverAProyectos() {
    setProyectoSeleccionado(null)
    setSeccionActiva('asignaciones')
  }

  // ── Login ──
  if (!isAuth) return (
    <div style={{
      minHeight: '100vh', background: '#f4f6f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #dde2ea',
        boxShadow: '0 1px 3px rgba(30,42,58,.07), 0 4px 12px rgba(30,42,58,.05)',
        padding: '40px 48px', textAlign: 'center', maxWidth: '380px', width: '100%'
      }}>
        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.16em', color: '#9eaabb', marginBottom: '8px' }}>GoSCM</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a3a6e', margin: '0 0 6px' }}>Resource Planning</h1>
        <p style={{ fontSize: '12px', color: '#6b7c93', fontFamily: "'DM Mono', monospace", margin: '0 0 28px' }}>
          Planificación de recursos · 2026
        </p>
        <button
          onClick={handleLogin}
          style={{
            width: '100%', padding: '10px 20px', background: '#2557a7', color: '#fff',
            border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1a3a6e'}
          onMouseLeave={e => e.currentTarget.style.background = '#2557a7'}
        >
          Iniciar sesión con Microsoft
        </button>
      </div>
    </div>
  )

  // ── Cargando ──
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ color: '#9eaabb', fontSize: '12px', fontFamily: "'DM Mono', monospace" }}>Cargando...</div>
    </div>
  )

  // ── Sin acceso ──
  if (role === 'sin_acceso') return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: '#fdeaea', border: '1px solid #e53935', borderRadius: '10px', padding: '28px 36px', textAlign: 'center', maxWidth: '340px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#8b1a1a', marginBottom: '8px' }}>Sin acceso</div>
        <p style={{ fontSize: '12px', color: '#8b1a1a', margin: 0 }}>Tu usuario no tiene permisos. Contactá al administrador.</p>
      </div>
    </div>
  )

  // ── Shell ──
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '210px 1fr', minHeight: '100vh',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      fontSize: '13px', background: '#f4f6f9', color: '#1e2a3a'
    }}>

      {/* ── Sidebar ── */}
      <div style={{
        background: '#fff', borderRight: '1px solid #dde2ea',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 15px 13px', background: '#1a3a6e' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.16em', color: 'rgba(255,255,255,.4)' }}>GoSCM</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '3px', lineHeight: 1.3 }}>Resource Planning</div>
          <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,.38)', marginTop: '2px', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {proyectoSeleccionado
              ? (proyectoSeleccionado.field_1 || proyectoSeleccionado.Proyecto || 'Proyecto')
              : 'Seleccioná un proyecto'}
          </div>
        </div>

        {/* Nav principal */}
        <div style={{ padding: '10px 0 4px' }}>
          <div style={nl}>Navegación</div>

          {/* Staffing Planner */}
          <NavItem
            icon="←" label="Staffing Planner"
            href={DIEGO_URL}
          />

          {/* Proyectos */}
          <NavItem
            icon="◫" label="Proyectos"
            activo={!proyectoSeleccionado}
            onClick={volverAProyectos}
          />

          {/* Secciones del proyecto — solo si hay proyecto seleccionado */}
          {proyectoSeleccionado && (
            <>
              <div style={{ ...nl, marginTop: '6px', paddingLeft: '14px' }}>
                Proyecto
              </div>
              {SECCIONES.map(sec => (
                <NavItem
                  key={sec.id}
                  icon={sec.icon}
                  label={sec.label}
                  activo={seccionActiva === sec.id}
                  onClick={() => setSeccionActiva(sec.id)}
                  indent
                />
              ))}
            </>
          )}
        </div>

        {/* Usuario */}
        <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid #dde2ea' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#9eaabb', marginBottom: '4px' }}>
            Usuario
          </div>
          <div style={{ fontSize: '11.5px', fontWeight: 500, color: '#1e2a3a', marginBottom: '4px' }}>
            {accounts[0]?.name}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 6px',
            borderRadius: '9px', fontSize: '9px', fontWeight: 700,
            fontFamily: "'DM Mono', monospace",
            background: role === 'admin' ? '#e6f4ed' : role === 'rm' ? '#e8eef8' : '#f0eaff',
            color: role === 'admin' ? '#1a6640' : role === 'rm' ? '#1a3a6e' : '#4a1a8a'
          }}>
            {role?.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ padding: '22px 30px', overflowX: 'hidden', minWidth: 0 }}>

        {/* Page header */}
        <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1a3a6e', margin: 0 }}>
              {proyectoSeleccionado
                ? (proyectoSeleccionado.field_1 || proyectoSeleccionado.Proyecto || 'Proyecto')
                : 'Proyectos'}
            </h1>
            <p style={{ fontSize: '10.5px', color: '#6b7c93', marginTop: '2px', fontFamily: "'DM Mono', monospace" }}>
              {proyectoSeleccionado
                ? SECCIONES.find(s => s.id === seccionActiva)?.label || seccionActiva
                : 'Seleccioná un proyecto para ver sus detalles'}
            </p>
          </div>

          {proyectoSeleccionado && (
            <button
              onClick={volverAProyectos}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', background: '#fff', border: '1px solid #dde2ea',
                borderRadius: '7px', cursor: 'pointer', fontSize: '12px',
                fontWeight: 500, color: '#6b7c93',
                boxShadow: '0 1px 3px rgba(30,42,58,.07)',
                fontFamily: 'inherit', transition: 'all .13s'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#1e2a3a'; e.currentTarget.style.borderColor = '#c8d0dc' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6b7c93'; e.currentTarget.style.borderColor = '#dde2ea' }}
            >
              ← Volver a proyectos
            </button>
          )}
        </div>

        {/* Contenido */}
        {!proyectoSeleccionado ? (
          <Inicio role={role} roleId={roleId} onSeleccionarProyecto={seleccionarProyecto} />
        ) : seccionActiva === 'asignaciones' ? (
          <Asignaciones role={role} roleId={roleId} proyecto={proyectoSeleccionado} />
        ) : seccionActiva === 'facturacion' ? (
          <Facturacion proyecto={proyectoSeleccionado} />
        ) : null}
      </div>
    </div>
  )
}

// ── Componente NavItem ──
function NavItem({ icon, label, activo, onClick, href, indent }) {
  const base = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: `7px 14px 7px ${indent ? '24px' : '14px'}`,
    fontSize: '12px', fontWeight: activo ? 600 : 500,
    color: activo ? '#2557a7' : '#6b7c93',
    background: activo ? '#e8eef8' : 'transparent',
    borderLeft: `3px solid ${activo ? '#3b72d9' : 'transparent'}`,
    cursor: 'pointer', transition: 'all .13s',
    textDecoration: 'none'
  }

  const handleHover = (e, enter) => {
    if (activo) return
    e.currentTarget.style.color = enter ? '#1e2a3a' : '#6b7c93'
    e.currentTarget.style.background = enter ? '#f0f3f7' : 'transparent'
  }

  if (href) {
    return (
      <a href={href} style={base}
        onMouseEnter={e => handleHover(e, true)}
        onMouseLeave={e => handleHover(e, false)}
      >
        <span style={{ fontSize: '11px', width: '14px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
        {label}
      </a>
    )
  }

  return (
    <div style={base} onClick={onClick}
      onMouseEnter={e => handleHover(e, true)}
      onMouseLeave={e => handleHover(e, false)}
    >
      <span style={{ fontSize: '11px', width: '14px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {label}
    </div>
  )
}

const nl = {
  padding: '2px 14px 5px', fontSize: '8.5px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.14em', color: '#9eaabb'
}

export default App
