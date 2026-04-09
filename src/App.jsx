import { useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest } from './authConfig'
import { useRole } from './hooks/useRole'
import Inicio from './pages/Inicio'
import Asignaciones from './pages/Asignaciones'

function App() {
  const { instance, accounts } = useMsal()
  const isAuth = useIsAuthenticated()
  const { role, roleId, loading } = useRole(instance, accounts)
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null)

  const handleLogin = () => instance.loginRedirect(loginRequest)

  if (!isAuth) return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Resource Planning</h1>
      <button onClick={handleLogin}>Iniciar sesión con Microsoft</button>
    </div>
  )

  if (loading) return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <p>Cargando...</p>
    </div>
  )

  if (role === 'sin_acceso') return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h2>Sin acceso</h2>
      <p>Tu usuario no tiene permisos. Contactá al administrador.</p>
    </div>
  )

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f8f8f8' }}>

      {/* Header */}
      <div style={{ background: '#185FA5', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {proyectoSeleccionado && (
            <button
              onClick={() => setProyectoSeleccionado(null)}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              ← Volver
            </button>
          )}
          <span style={{ color: '#fff', fontWeight: '500', fontSize: '16px' }}>
            Resource Planning
            {proyectoSeleccionado && (
              <span style={{ color: '#B5D4F4', fontWeight: '400' }}> / {proyectoSeleccionado.Proyecto}</span>
            )}
          </span>
        </div>
        <span style={{ color: '#B5D4F4', fontSize: '13px' }}>
          {accounts[0]?.name} — {role.toUpperCase()}
        </span>
      </div>

      {/* Contenido */}
      {!proyectoSeleccionado
        ? <Inicio role={role} roleId={roleId} onSeleccionarProyecto={setProyectoSeleccionado} />
        : <Asignaciones role={role} roleId={roleId} proyecto={proyectoSeleccionado} />
      }

    </div>
  )
}

export default App